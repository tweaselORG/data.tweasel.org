from datasette import hookimpl
from markupsafe import escape, Markup
import base64
import json
import uuid

def is_human_readable_text(value):
    if isinstance(value, str):
        return value.replace('\n', '').isprintable()
    elif isinstance(value, bytes):
        try:
            string = value.decode("utf-8")
            return string.replace('\n', '').isprintable()
        except UnicodeDecodeError:
            return False
    else:
        return False

def as_base64(value):
    if isinstance(value, str):
        return base64.b64encode(value.encode("utf-8")).decode("utf-8")
    elif isinstance(value, bytes):
        return base64.b64encode(value).decode("utf-8")
    else:
        return None

def as_string(value):
    if isinstance(value, str):
        return value
    elif isinstance(value, bytes):
        return value.decode("utf-8")
    else:
        return None


@hookimpl
def render_cell(value, column, row):
    if (not column in ("path", "content", "headers", "cookies") and not column.endswith("_long")) or (not isinstance(value, str) and not isinstance(value, bytes) and value is not None):
        return None

    if value is None:
        value = ''

    make_textarea = lambda v: Markup(
        '<textarea class="tweasel-long-cell" readonly>{}</textarea>'.format(escape(v))
    )

    if column in ("headers", "cookies") and value.startswith("[") and value.endswith("]"):
        try:
            arr = json.loads(value)

            fmt = "{}: {}" if column == "headers" else "{}={}"
            formatted = "\n".join([fmt.format(v['name'], v['value']) for v in arr])

            id = uuid.uuid4()
            raw_id = "tweasel-long-cell-wrapper-{}-raw".format(id)
            formatted_id = "tweasel-long-cell-wrapper-{}-formatted".format(id)


            return Markup("""<div id="{}" style="display: none; white-space: normal;">
<button class="tweasel-toggle-button" onclick="document.getElementById('{}').style.display = 'none'; document.getElementById('{}').style.display = 'block';">show formatted</button><br>
{}
</div><div id="{}" style="display: block; white-space: normal;">
<button class="tweasel-toggle-button" onclick="document.getElementById('{}').style.display = 'none'; document.getElementById('{}').style.display = 'block';">show raw</button><br>
{}
</div>""".format(
    raw_id,
    raw_id,
    formatted_id,
    make_textarea(value),
    formatted_id,
    formatted_id,
    raw_id,
    make_textarea(formatted),
))

        except:
            pass

    if column == "content" and not is_human_readable_text(value):
        value_as_base64 = as_base64(value)

        filename = "tweasel-requests-{}.bin".format(column)
        if "dataset" in row.keys() and "id" in row.keys():
            filename = "tweasel-requests-{}-{}-{}.bin".format(row["dataset"], row["id"], column)
        elif "link(dataset, id)" in row.keys():
            filename = "tweasel-requests-{}-{}.bin".format(row["link(dataset, id)"].replace("perma:", "").replace(",", "-"), column)

        return Markup(
            '<em>as base64:</em><br>{}<br><a class="blob-download" href="data:application/octet-stream;base64,{}" download="{}">download binary content ({} bytes)</a>'.format(
                make_textarea(value_as_base64),
                escape(value_as_base64),
                escape(filename),
                len(value),
            )
        )

    return make_textarea(as_string(value))
