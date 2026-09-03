import Testing
@testable import LunaDesk

@MainActor
struct WorkspaceStoreTests {
    @Test func sendingDraftAppendsAndClearsComposer() {
        let store = WorkspaceStore()
        let initialCount = store.selectedTeammate?.messages.count
        store.draft = "Ship the recap"
        store.sendDraft()

        #expect(store.selectedTeammate?.messages.count == (initialCount ?? 0) + 1)
        #expect(store.selectedTeammate?.messages.last?.body == "Ship the recap")
        #expect(store.draft.isEmpty)
    }

    @Test func emptyDraftIsIgnored() {
        let store = WorkspaceStore()
        let initialCount = store.selectedTeammate?.messages.count
        store.draft = "   \n"
        store.sendDraft()
        #expect(store.selectedTeammate?.messages.count == initialCount)
    }

    @Test func searchMatchesNameAndPreview() {
        let store = WorkspaceStore()
        store.searchText = "expense"
        #expect(store.filteredTeammates.map(\.name) == ["Expense Manager"])
    }

    @Test func newAgentMatchesOriginalCreationState() {
        let store = WorkspaceStore()
        store.createAgent()

        #expect(store.selectedTeammate?.name == "New agent")
        #expect(store.selectedTeammate?.messages.count == 1)
        #expect(store.selectedTeammate?.messages.first?.body.hasPrefix("Hey Armand, good to meet you") == true)
        #expect(store.teammates.first?.name == "New agent")
    }

    @Test func creatingAgainReplacesUntouchedDraftAgent() {
        let store = WorkspaceStore()
        store.createAgent()
        let firstCount = store.teammates.count
        store.createAgent()

        #expect(store.teammates.count == firstCount)
        #expect(store.teammates.filter { $0.name == "New agent" }.count == 1)
        #expect(store.teammates.first?.name == "New agent")
    }

    @Test func plusOpensPickerWithoutCreatingAgent() {
        let store = WorkspaceStore()
        let count = store.teammates.count
        store.openAgentPicker()

        #expect(store.isAgentPickerPresented)
        #expect(store.teammates.count == count)
    }

    @Test func pickerSelectsExistingAgentAndCloses() {
        let store = WorkspaceStore()
        let chief = store.teammates.first { $0.name == "Chief" }!
        store.openAgentPicker()
        store.selectAgent(chief.id)

        #expect(store.selectedID == chief.id)
        #expect(!store.isAgentPickerPresented)
    }
}
