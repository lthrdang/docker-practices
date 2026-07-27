"""A small service to practise Dockerfile optimisation on.

Do not change this file (except to add a comment line when you measure rebuild
time). The exercise is the Dockerfile, not the app.
"""

import os
import socket

from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def index():
    return jsonify(
        service="homework",
        message="if you can read this, the image still works",
        host=socket.gethostname(),
    )


@app.route("/whoami")
def whoami():
    return jsonify(uid=os.getuid(), gid=os.getgid(), user=os.environ.get("USER", "unknown"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
