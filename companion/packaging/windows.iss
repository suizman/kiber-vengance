#define AppVersion "1.0.0"
[Setup]
AppId=KiberVenganceCompanion
AppName=КИБЕР VENGANCE Companion
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\KiberVenganceCompanion
DefaultGroupName=КИБЕР VENGANCE
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\out
OutputBaseFilename=KiberVengance-Companion-{#AppVersion}-x64-setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\KiberVengance.exe
LicenseFile=..\build\windows-x64\LICENSE.txt
[Files]
Source: "..\build\windows-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\КИБЕР VENGANCE Companion"; Filename: "{app}\KiberVengance.exe"
[Registry]
Root: HKCU; Subkey: "Software\Classes\kibervengance"; ValueType: string; ValueData: "URL:KiberVengance Companion"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\kibervengance"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\kibervengance\shell\open\command"; ValueType: string; ValueData: """{app}\KiberVengance.exe"" ""%1"""
[Run]
Filename: "{app}\KiberVengance.exe"; Description: "Open КИБЕР VENGANCE Companion"; Flags: nowait postinstall skipifsilent
