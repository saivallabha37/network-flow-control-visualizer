' Network Flow Control Protocols Visualizer
' Background Agent Launcher (Hidden / No Console Window)

Dim WshShell, fso, scriptDir, projectDir, batPath, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(scriptDir))

' Check if agent distribution exists or fallback to npx tsx
If fso.FileExists(projectDir & "\agent\dist\live\cli.js") Then
    cmd = "node """ & projectDir & "\agent\dist\live\cli.js"" --udp 9000 --ws 8080"
Else
    cmd = "cmd.exe /c cd /d """ & projectDir & """ && npx tsx agent/src/live/cli.ts --udp 9000 --ws 8080"
End If

' Run completely hidden without creating a visible console window (0 = hide)
WshShell.CurrentDirectory = projectDir
WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing

