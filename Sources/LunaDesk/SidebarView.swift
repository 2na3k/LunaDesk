import SwiftUI

struct SidebarView: View {
    @Bindable var store: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            titlebar
            search
            teammateList
            profile
        }
        .background(AppTheme.window)
    }

    private var titlebar: some View {
        HStack {
            Spacer()
            Button(action: store.openAgentPicker) {
                Image(systemName: "plus")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(AppTheme.secondary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .help("New agent (⌘N)")
            .accessibilityLabel("New agent")
        }
        .frame(height: 44)
        .padding(.trailing, 10)
    }

    private var search: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(AppTheme.secondary)
            TextField("Search", text: $store.searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(AppTheme.elevated.opacity(0.72), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.stroke))
        .padding(.horizontal, 14)
        .padding(.bottom, 11)
    }

    private var teammateList: some View {
        ScrollView {
            LazyVStack(spacing: 2) {
                ForEach(store.filteredTeammates) { teammate in
                    TeammateRow(teammate: teammate, isSelected: teammate.id == store.selectedID)
                        .contentShape(Rectangle())
                        .onTapGesture { store.selectedID = teammate.id }
                        .accessibilityAddTraits(teammate.id == store.selectedID ? .isSelected : [])
                }
            }
            .padding(.horizontal, 10)
        }
        .scrollIndicators(.hidden)
    }

    private var profile: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.white.opacity(0.08))
                .frame(width: 34, height: 34)
                .overlay(Text("AS").font(.system(size: 11, weight: .medium)).foregroundStyle(AppTheme.secondary))
            Text("Armand Segall")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AppTheme.primary)
            Spacer()
        }
        .padding(.horizontal, 16)
        .frame(height: 61)
    }
}

private struct TeammateRow: View {
    let teammate: Teammate
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 10) {
            BotMark(color: teammate.color, symbol: teammate.symbol, size: 37)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(teammate.name)
                        .font(.system(size: 14.5, weight: .medium))
                        .foregroundStyle(AppTheme.primary)
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    Text(teammate.timestamp)
                        .font(.system(size: 12.5))
                        .foregroundStyle(AppTheme.secondary)
                }
                Text(teammate.preview)
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 9)
        .frame(height: 57)
        .background(isSelected ? AppTheme.selected : Color.clear, in: RoundedRectangle(cornerRadius: 11))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(teammate.name), \(teammate.preview), \(teammate.timestamp)")
    }
}
