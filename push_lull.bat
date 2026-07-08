@echo off
cd /d "C:\Users\ethan\OneDrive\Desktop\lull"
if exist ".git\index.lock" del /f /q ".git\index.lock"
echo === git add === > push_log.txt
git add -A >> push_log.txt 2>&1
git reset -- push_lull.bat push_log.txt >> push_log.txt 2>&1
echo === git commit === >> push_log.txt
git commit -m "iOS notification sounds + settings, app icon, responsive layout, local notifications" >> push_log.txt 2>&1
echo === git push === >> push_log.txt
git push >> push_log.txt 2>&1
echo === (pull if needed, then push again) === >> push_log.txt
git pull --no-edit >> push_log.txt 2>&1
git push >> push_log.txt 2>&1
echo === DONE === >> push_log.txt
echo.
echo ================= RESULT =================
type push_log.txt
echo =========================================
echo.
echo Finished. This window can be closed.
pause
