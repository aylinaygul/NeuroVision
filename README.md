[poster.pdf](https://github.com/user-attachments/files/16245167/poster.pdf)


# For GPT
redis-server &

rm -rf myenv
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt

daphne project.asgi:application

# For Start Detection
cd /backend/model
python app.py
