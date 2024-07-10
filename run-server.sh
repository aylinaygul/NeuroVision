#!/bin/bash

# Start Redis server
redis-server &

rm -rf myenv
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt


# Start Daphne server
daphne project.asgi:application
