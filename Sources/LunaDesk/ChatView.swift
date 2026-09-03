import SwiftUI

struct ChatView: View {
    @Bindable var store: WorkspaceStore
    @FocusState private var composerFocused: Bool

    var body: some View {
        Group {
            if store.isAgentPickerPresented {
                AgentPickerView(store: store)
            } else {
                VStack(spacing: 0) {
                    header
                    Divider().overlay(AppTheme.stroke)
                    transcript
                    composer
                }
            }
        }
        .background(AppTheme.content)
        .onAppear { composerFocused = true }
    }

    private var header: some View {
        HStack(spacing: 9) {
            if let teammate = store.selectedTeammate {
                BotMark(color: teammate.color, symbol: teammate.symbol, size: 22)
                Text(teammate.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(AppTheme.primary)
            } else {
                Text("Select a teammate")
                    .foregroundStyle(AppTheme.secondary)
            }
            Spacer()
        }
        .padding(.leading, 18)
        .padding(.trailing, 12)
        .frame(height: 44)
        .background(AppTheme.content)
    }

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 11) {
                    if let messages = store.selectedTeammate?.messages {
                        ForEach(messages) { message in
                            MessageRow(message: message)
                                .id(message.id)
                        }
                    }
                }
                .padding(.horizontal, 25)
                .padding(.vertical, 22)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollIndicators(.hidden)
            .onChange(of: store.selectedTeammate?.messages.count) {
                if let last = store.selectedTeammate?.messages.last { withAnimation { proxy.scrollTo(last.id) } }
            }
        }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            Button(action: store.openAgentPicker) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .medium))
                    .frame(width: 34, height: 34)
                    .background(Color.white.opacity(0.05), in: Circle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(AppTheme.secondary)
            .accessibilityLabel("New agent")

            TextField("Message \(store.selectedTeammate?.name ?? "teammate")", text: $store.draft, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 14.5))
                .focused($composerFocused)
                .lineLimit(1...4)
                .onSubmit(store.sendDraft)

            Button {
                if store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    store.isRecording.toggle()
                } else {
                    store.sendDraft()
                }
            } label: {
                Image(systemName: store.draft.isEmpty ? (store.isRecording ? "stop.fill" : "mic.fill") : "arrow.up")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.black)
                    .frame(width: 34, height: 34)
                    .background(store.isRecording ? Color.red : Color.white, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(store.draft.isEmpty ? (store.isRecording ? "Stop recording" : "Start recording") : "Send message")
        }
        .padding(.horizontal, 10)
        .frame(minHeight: 48)
        .background(Color.black.opacity(0.08), in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(AppTheme.stroke))
        .padding(.horizontal, 24)
        .padding(.bottom, 17)
        .padding(.top, 8)
    }
}

private struct AgentPickerView: View {
    @Bindable var store: WorkspaceStore
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 7) {
                Text("To:")
                    .foregroundStyle(AppTheme.secondary)
                TextField("Search or create agents", text: $store.agentPickerSearchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .focused($searchFocused)
                    .onSubmit {
                        if let first = store.agentPickerResults.first {
                            store.selectAgent(first.id)
                        } else {
                            store.createAgent()
                        }
                    }
            }
            .font(.system(size: 15))
            .padding(.horizontal, 18)
            .frame(height: 44)
            .overlay(alignment: .bottom) { Divider().overlay(AppTheme.stroke) }

            VStack(alignment: .leading, spacing: 0) {
                Button(action: store.createAgent) {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.white.opacity(0.08))
                            .frame(width: 36, height: 36)
                            .overlay(Image(systemName: "plus").foregroundStyle(AppTheme.secondary))
                        Text("Create new agent")
                            .foregroundStyle(AppTheme.primary)
                        Spacer()
                    }
                    .frame(height: 56)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Create new agent")

                ForEach(store.agentPickerResults) { teammate in
                    Button { store.selectAgent(teammate.id) } label: {
                        HStack(spacing: 12) {
                            BotMark(color: teammate.color, symbol: teammate.symbol, size: 36)
                            Text(teammate.name)
                                .foregroundStyle(AppTheme.primary)
                            Spacer()
                        }
                        .frame(height: 56)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(teammate.name)
                }
            }
            .font(.system(size: 15))
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(AppTheme.content, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.stroke))
            .shadow(color: .black.opacity(0.22), radius: 24, y: 18)
            .padding(.horizontal, 16)
            .padding(.top, 8)

            Spacer(minLength: 0)
        }
        .onAppear { searchFocused = true }
        .onExitCommand { store.isAgentPickerPresented = false }
    }
}

private struct MessageRow: View {
    let message: ChatMessage

    var body: some View {
        switch message.sender {
        case .system:
            Text(message.body)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(AppTheme.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 1)
        case .user:
            HStack {
                Spacer(minLength: 100)
                Text(message.body)
                    .messageBubble(background: Color(red: 0.88, green: 0.88, blue: 0.86), foreground: .black)
            }
        case .teammate(let name):
            VStack(alignment: .leading, spacing: 6) {
                Text(name)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(AppTheme.secondary)
                    .padding(.leading, 4)
                HStack {
                    Text(message.body)
                        .messageBubble(background: AppTheme.elevated, foreground: AppTheme.primary)
                    Spacer(minLength: 90)
                }
            }
        }
    }
}

private extension View {
    func messageBubble(background: Color, foreground: Color) -> some View {
        self
            .font(.system(size: 14.5))
            .foregroundStyle(foreground)
            .lineSpacing(3)
            .textSelection(.enabled)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(background, in: RoundedRectangle(cornerRadius: 17))
            .fixedSize(horizontal: false, vertical: true)
    }
}
