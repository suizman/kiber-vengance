#import <AppKit/AppKit.h>

@interface CompanionDelegate : NSObject <NSApplicationDelegate>
@property BOOL launched;
@end
@implementation CompanionDelegate
- (void)openCompanion {
    if (self.launched) return;
    self.launched = YES;
    NSString *resources = [[NSBundle mainBundle] resourcePath];
    NSTask *task = [[NSTask alloc] init];
    task.executableURL = [NSURL fileURLWithPath:[resources stringByAppendingPathComponent:@"python/bin/python3"]];
    task.arguments = @[@"-m", @"kv_companion"];
    NSMutableDictionary *environment = [[[NSProcessInfo processInfo] environment] mutableCopy];
    environment[@"PYTHONHOME"] = [resources stringByAppendingPathComponent:@"python"];
    environment[@"PYTHONPATH"] = [resources stringByAppendingPathComponent:@"lib"];
    environment[@"PYTHONNOUSERSITE"] = @"1";
    task.environment = environment;
    NSError *error = nil;
    if (![task launchAndReturnError:&error]) {
        NSAlert *alert = [[NSAlert alloc] init];
        alert.messageText = @"КИБЕР VENGANCE could not start";
        alert.informativeText = [error localizedDescription];
        [alert runModal];
    }
    [NSApp terminate:nil];
}
- (void)applicationDidFinishLaunching:(NSNotification *)notification { [self openCompanion]; }
- (void)application:(NSApplication *)application openURLs:(NSArray<NSURL *> *)urls { [self openCompanion]; }
@end
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        CompanionDelegate *delegate = [[CompanionDelegate alloc] init];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
