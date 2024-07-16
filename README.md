![poster](https://github.com/user-attachments/assets/f7606642-7297-4a2d-8440-bd8daef6b88f)
[presentation.pdf](https://github.com/user-attachments/files/16245196/presentation.pdf)

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
