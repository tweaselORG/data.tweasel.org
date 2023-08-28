# Tweasel open data Datasette instance

This repository contains the scripts for hosting, and configuration of the Tweasel open data Datasette instance hosted at [data.tweasel.org](https://data.tweasel.org). The homepage contains a more detailed description of what the instance is about. For technical details about how it was set up, see [tweaselORG/meta#33](https://github.com/tweaselORG/meta/issues/33).

## Creating the main database

The main database is created dynamically, combining the datasets into a single `requests` table. To create the database, you need to have all the individual SQLite databases of the datasets (specified in `datasets.json`) in the `datasets` folder (they are not included in the repo but archived in a B2 bucket).

Then, you can run `yarn make-database` to create the database. This will (re-)create and correctly configure `datasette/data.db`.

## Running Datasette

We are using Datasette in [configuration directory mode](https://docs.datasette.io/en/stable/settings.html#configuration-directory-mode), as such you only need to pass that folder to get the correct configuration:

```sh
datasette datasette/
```

## Adding a new dataset

To add a new dataset, you need to:

1. Create an SQLite database of the requests in the dataset in the correct format. See: [example of creating such a database from HAR files](https://github.com/tweaselORG/experiments/blob/main/monkey-july-2023/export-to-db.ts), [examples of creating such a database from an existing PostgreSQL database](https://github.com/tweaselORG/meta/issues/33)
2. Upload the SQLite database to the B2 bucket.
3. Store the SQLite database in the `datasets` folder (with a name of `<slug>.db`).
4. Add the dataset and its metadata to `datasets.json`.
5. Mention the dataset in `datasette/templates/index.html` (in the "Datasets" section).
6. Run `yarn make-database` to recreate the main database.

## Plugins

We are using the following Datasette plugins:

* datasette-copyable
* datasette-graphql
* datasette-jq
* datasette-sqlite-regex
* datasette-sqlite-url
* datasette-sqlite-path
* datasette-cors
