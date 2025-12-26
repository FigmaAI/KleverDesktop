import argparse
import os

from scripts.utils import print_with_color

arg_desc = "AppAgent - deployment phase"
parser = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter, description=arg_desc)
parser.add_argument("--app")
parser.add_argument("--root_dir", default="./")
parser.add_argument("--platform", choices=["android"], default="android", help="Platform to automate")
args = vars(parser.parse_args())

app = args["app"]
root_dir = args["root_dir"]
platform = args["platform"]

print_with_color("Welcome to the deployment phase of AppAgent!\nBefore giving me the task, you should first tell me "
                 "the app name and what documentation base you want me to use. I will "
                 "try my best to complete the task without your intervention.", "yellow")

print_with_color("Please enter the main interface of the app on your Android device.", "yellow")

if not app:
    print_with_color("What is the name of the target app?", "blue")
    app = input()
    app = app.replace(" ", "")

os.system(f"python scripts/task_executor.py --app {app} --root_dir {root_dir} --platform {platform}")
