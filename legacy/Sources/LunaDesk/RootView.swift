import SwiftUI

struct RootView: View {
    @Bindable var store: WorkspaceStore

    var body: some View {
        GeometryReader { geometry in
            HSplitView {
                SidebarView(store: store)
                    .frame(minWidth: 255, idealWidth: 300, maxWidth: 360)
                ChatView(store: store)
                    .frame(minWidth: 600)
            }
            .frame(width: geometry.size.width, height: geometry.size.height + 28)
            .offset(y: -28)
        }
        .background(AppTheme.window)
        .background(WindowConfiguration())
        .tint(.white)
    }
}
