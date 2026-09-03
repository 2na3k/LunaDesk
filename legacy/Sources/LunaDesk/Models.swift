import Foundation
import Observation
import SwiftUI

struct Teammate: Identifiable, Hashable {
    let id: UUID
    var name: String
    var preview: String
    var timestamp: String
    var color: Color
    var symbol: BotSymbol
    var messages: [ChatMessage]

    init(
        id: UUID = UUID(),
        name: String,
        preview: String,
        timestamp: String,
        color: Color,
        symbol: BotSymbol,
        messages: [ChatMessage] = []
    ) {
        self.id = id
        self.name = name
        self.preview = preview
        self.timestamp = timestamp
        self.color = color
        self.symbol = symbol
        self.messages = messages
    }
}

enum BotSymbol: CaseIterable, Hashable {
    case circle, capsule, triangle, diamond
}

struct ChatMessage: Identifiable, Hashable {
    enum Sender: Hashable { case user, teammate(String), system }

    let id: UUID
    let sender: Sender
    let body: String
    let timestamp: String?

    init(id: UUID = UUID(), sender: Sender, body: String, timestamp: String? = nil) {
        self.id = id
        self.sender = sender
        self.body = body
        self.timestamp = timestamp
    }
}

@MainActor
@Observable
final class WorkspaceStore {
    var teammates: [Teammate]
    var selectedID: UUID?
    var searchText = ""
    var agentPickerSearchText = ""
    var isAgentPickerPresented = false
    var draft = ""
    var isRecording = false

    init(teammates: [Teammate] = SampleData.teammates) {
        self.teammates = teammates
        self.selectedID = teammates.last?.id
    }

    var filteredTeammates: [Teammate] {
        guard !searchText.trimmingCharacters(in: .whitespaces).isEmpty else { return teammates }
        return teammates.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.preview.localizedCaseInsensitiveContains(searchText)
        }
    }

    var selectedTeammate: Teammate? {
        teammates.first { $0.id == selectedID }
    }

    var agentPickerResults: [Teammate] {
        let query = agentPickerSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return teammates.filter { $0.name != "Offsite crew" } }
        return teammates.filter {
            $0.name != "Offsite crew" && $0.name.localizedCaseInsensitiveContains(query)
        }
    }

    func openAgentPicker() {
        agentPickerSearchText = ""
        isAgentPickerPresented = true
    }

    func selectAgent(_ id: UUID) {
        selectedID = id
        isAgentPickerPresented = false
        agentPickerSearchText = ""
    }

    func sendDraft() {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, let selectedID,
              let index = teammates.firstIndex(where: { $0.id == selectedID }) else { return }
        teammates[index].messages.append(ChatMessage(sender: .user, body: body))
        teammates[index].preview = body
        teammates[index].timestamp = "Now"
        draft = ""
    }

    func createAgent() {
        let teammate = Teammate(
            name: "New agent",
            preview: "Hey Armand, good to meet you. What do…",
            timestamp: "Now",
            color: .orange,
            symbol: .circle,
            messages: [
                ChatMessage(
                    sender: .teammate("New agent"),
                    body: "Hey Armand, good to meet you. What do you want me around for? Anything concrete, or more of a general sidekick?"
                )
            ]
        )
        if let existingDraft = teammates.firstIndex(where: { $0.name == "New agent" }) {
            teammates.remove(at: existingDraft)
        }
        teammates.insert(teammate, at: 0)
        selectedID = teammate.id
        draft = ""
        isAgentPickerPresented = false
        agentPickerSearchText = ""
    }
}

enum SampleData {
    static let teammates: [Teammate] = [
        teammate("Chief", "booked the venue and sent the confirmation…", "Yesterday", .teal, .circle),
        teammate("Sales Outbound", "Done.", "12:18 PM", .orange, .circle),
        teammate("Inbox Manager", "sent. inbox at zero, 5 drafts parked…", "9:19 AM", .indigo, .triangle),
        teammate("Account Manager", "invite's out to vicky. globex note…", "7:19 AM", .purple, .diamond),
        teammate("Talent Scout", "3 intros drafted in your voice, held…", "4:19 AM", .blue, .triangle),
        teammate("Expense Manager", "report filed. 9 receipts, nothing open.", "8:19 AM", .orange, .circle),
        Teammate(
            name: "Offsite crew",
            preview: "that leaves the pipeline. i'd spin up…",
            timestamp: "6:19 AM",
            color: .mint,
            symbol: .capsule,
            messages: [
                ChatMessage(sender: .user, body: "let's close out the offsite. what's left?"),
                ChatMessage(sender: .teammate("Account Manager"), body: "recap doc is done and owners are tagged. 3 follow-ups land this week."),
                ChatMessage(sender: .teammate("Inbox Manager"), body: "thank-you notes went out to the venue and the speakers this morning."),
                ChatMessage(sender: .system, body: "6:19 AM"),
                ChatMessage(sender: .teammate("Chief"), body: "recap's shared. follow-ups, assigned:\n✓ Acme pricing follow-up → Account Manager · numbers by thursday\n✓ Speaker + venue thank-yous → Inbox Manager · done this morning\n✓ Final invoice → me · reconciling against the expense report\n👍"),
                ChatMessage(sender: .user, body: "great close-out. anything we missed?"),
                ChatMessage(sender: .teammate("Chief"), body: "that leaves the pipeline: nobody's touched the quiet accounts. i'd spin up a dedicated agent for outbound.")
            ]
        )
    ]

    private static func teammate(
        _ name: String, _ preview: String, _ timestamp: String, _ color: Color, _ symbol: BotSymbol
    ) -> Teammate {
        Teammate(
            name: name,
            preview: preview,
            timestamp: timestamp,
            color: color,
            symbol: symbol,
            messages: [ChatMessage(sender: .system, body: "No recent messages.")]
        )
    }
}
