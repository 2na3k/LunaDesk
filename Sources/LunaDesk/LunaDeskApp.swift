import SwiftUI

@main
struct LunaDeskApp: App {
    @State private var store = WorkspaceStore()

    var body: some Scene {
        WindowGroup {
            RootView(store: store)
                .ignoresSafeArea(.container, edges: .top)
                .frame(minWidth: 920, minHeight: 620)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1180, height: 760)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New agent") { store.openAgentPicker() }
                    .keyboardShortcut("n", modifiers: .command)
            }
        }
    }
}
