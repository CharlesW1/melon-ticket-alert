## 2025-02-12 - [Python Performance]
**Learning:** Using 'requests.Session()' is essential for scripts with repeated API calls to enable connection pooling. Additionally, hoisting static API calls (like block lists) out of loops significantly reduces redundant I/O.
**Action:** Always check for 'requests.Session()' and loop-hoisting opportunities in Python monitoring scripts.

## 2025-02-12 - [Clean Workspace]
**Learning:** Running 'python3 -m py_compile' or executing Python scripts generates '__pycache__' directories, which must not be committed to the repository.
**Action:** Always ensure '.gitignore' includes '__pycache__/' and clean up local cache files before submitting.
