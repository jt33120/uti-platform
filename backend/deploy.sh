#!/bin/bash
set -e
cd /home/julian.talou/app/backend
git pull origin master
source venv/bin/activate
pip install -r requirements.txt -q
sudo systemctl restart uti-backend
sudo systemctl status uti-backend --no-pager
