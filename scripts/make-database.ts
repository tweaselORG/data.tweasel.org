import Database from 'better-sqlite3';
import yesno from 'yesno';
import * as sqliteRegex from 'sqlite-regex';
import * as sqliteUrl from 'sqlite-url';
import fse from 'fs-extra';
import datasets from '../datasets.json';

(async () => {
    if (await fse.pathExists('datasette/data.db')) {
        const ok = await yesno({
            question: 'This will delete and recreate your existing `datasette/data.db`. Do you want to continue?',
        });
        if (!ok) process.exit(1);
        await fse.remove('datasette/data.db');
    }

    const db = new Database('datasette/data.db');
    db.loadExtension(sqliteRegex.getLoadablePath());
    db.loadExtension(sqliteUrl.getLoadablePath());
    db.pragma('journal_mode = WAL');

    // Create and fill `datasets` table.
    db.exec(`
create table "datasets" (
    "slug" text,
    "title" text not null,
    "description" text not null,
    "url" text not null,
    "sourceCodeUrl" text,
    primary key("slug")
) without rowid;
`);

    const insertDataset = db.prepare(`
insert into "datasets" ("slug", "title", "description", "url", "sourceCodeUrl")
values (?, ?, ?, ?, ?);
`);
    for (const d of datasets) insertDataset.run(d.slug, d.title, d.description, d.url, d.sourceCodeUrl);

    // Create and fill `requests` table.
    db.exec(`
create table "requests" (
    "id" text,
    "dataset" text,
    "initiator" text,
    "platform" text not null,
    "runType" text,
    "startTime" text not null,
    "method" text not null,
    "httpVersion" text,
    "endpointUrl" text not null,
    "scheme" text,
    "host" text not null,
    "port" integer,
    "path" text not null,
    "content" blob,
    "headers" text not null,
    "cookies" text not null,
    foreign key("dataset") references "datasets"("slug"),
    primary key("dataset", "id")
) without rowid;
`);

    for (const d of datasets) db.exec(`attach './datasets/${d.slug}.db' as '${d.slug}';`);

    db.exec(`
insert into requests
    select id, dataset, initiator, platform, runType, startTime, method, httpVersion, endpointUrl, scheme, host, port, path, content, headers, cookies from (
        with vendors as materialized (
            select id, dataset, initiator, platform, runType, startTime, method, httpVersion, scheme, host, port, path, content, headers, cookies,
                case
                    when initiator is null then null
                    when instr(initiator,'.') = 0 then initiator
                    when instr(initiator,'@') = 0 then url_host(initiator)
                    else regex_replace('\\.[^.]+@.+?$', initiator, '')
                end as vendor,
                -- For the 'do-they-track' requests, we don't know the scheme, so we guess 'https'. That is reasonable considering that less than 0.5 % of requests in the rest of the dataset use 'http'.
                coalesce(endpointUrl, regex_replace('\\?.+$', coalesce(scheme, 'https://') || host || path, '')) as endpointUrl,
                -- For counting the endpoints, it doesn't make sense to consider the scheme in either case.
                regex_replace('\\?.+$', host || path, '')  as _endpointForCounting
            from (
                ${datasets.map((d) => `select * from '${d.slug}'.requests`).join('\nunion all\n')}
            )
        )

        select * from vendors where
            -- Only include requests that are made to the same endpointUrl by apps from at least two different vendors/websites from at least ten different hosts (https://github.com/tweaselORG/meta/issues/33#issuecomment-1658348929).
            _endpointForCounting in (
                select _endpointForCounting
                from vendors
                group by _endpointForCounting
                having
                    (count(distinct vendor) >= 10 and platform = 'web') or
                    (count(distinct vendor) >= 2 and platform != 'web')
                union
                select _endpointForCounting from vendors where vendor is null
            )
            -- Filter out iOS system background traffic as that may contain authentication values (https://github.com/tweaselORG/meta/issues/33#issuecomment-1660099572),
            and (not platform = 'ios' or initiator is not null)
    );
`);

    // Create indexes to speed up facets (https://docs.datasette.io/en/stable/facets.html#speeding-up-facets-with-indexes).
    for (const facetColumn of ['method', 'dataset', 'runType', 'scheme', 'platform'])
        db.exec(`create index "requests_${facetColumn}" on "requests"("${facetColumn}");`);
})();
