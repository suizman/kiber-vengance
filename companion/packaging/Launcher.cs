using System;
using System.Diagnostics;
using System.IO;

internal static class Launcher {
    [STAThread]
    public static void Main() {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        var start = new ProcessStartInfo(Path.Combine(root, "python", "pythonw.exe"), "-m kv_companion");
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.WorkingDirectory = root;
        start.EnvironmentVariables["PYTHONHOME"] = Path.Combine(root, "python");
        start.EnvironmentVariables["PYTHONPATH"] = Path.Combine(root, "lib");
        start.EnvironmentVariables["PYTHONNOUSERSITE"] = "1";
        Process.Start(start);
    }
}
