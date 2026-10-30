@echo off
setlocal
cd /d "%~dp0"
set "JAVA_TOOL_OPTIONS=-Xmx3072m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC"
set "GRADLE_OPTS=-Xmx3072m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC"
call gradlew.bat --stop >nul 2>&1
call gradlew.bat bundleRelease --max-workers=1 "-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC" %*
exit /b %ERRORLEVEL%
