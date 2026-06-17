import os
import sys

# Make the backend package importable (`import services.scoring`) regardless of
# the directory pytest is invoked from.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
