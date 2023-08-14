from datasette import hookimpl
from markupsafe import escape, Markup


@hookimpl
def prepare_connection(conn):
    conn.create_function(
        "link", 2, lambda dataset, id: "perma:{},{}".format(dataset, id)
    )


@hookimpl
def render_cell(value, database, datasette):
    if not value or not isinstance(value, str) or not value.startswith("perma:"):
        return None

    _ , id = value.split(":")
    if not id or not "," in id:
        return None
    return Markup(
        '<a href="{}">{}</a>'.format(
            escape(datasette.urls.path(f"/{database}/requests/{id}")),
            escape(id)
        )
    )
