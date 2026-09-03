import SwiftUI

enum AppTheme {
    static let window = Color(red: 0.082, green: 0.082, blue: 0.082)
    static let content = Color(red: 0.135, green: 0.135, blue: 0.135)
    static let elevated = Color(red: 0.19, green: 0.19, blue: 0.19)
    static let selected = Color(red: 0.16, green: 0.16, blue: 0.16)
    static let stroke = Color.white.opacity(0.09)
    static let primary = Color(red: 0.88, green: 0.88, blue: 0.88)
    static let secondary = Color(red: 0.48, green: 0.48, blue: 0.50)
}

struct BotMark: View {
    let color: Color
    let symbol: BotSymbol
    var size: CGFloat = 38

    var body: some View {
        ZStack {
            Group {
                switch symbol {
                case .circle:
                    Circle()
                case .capsule:
                    UnevenRoundedRectangle(topLeadingRadius: size * 0.5, bottomLeadingRadius: size * 0.5,
                                           bottomTrailingRadius: size * 0.48, topTrailingRadius: size * 0.35)
                case .triangle:
                    RoundedTriangle()
                case .diamond:
                    RoundedRectangle(cornerRadius: size * 0.27)
                        .rotationEffect(.degrees(45))
                        .padding(size * 0.08)
                }
            }
            .foregroundStyle(color)

            HStack(spacing: size * 0.12) {
                Capsule().frame(width: size * 0.07, height: size * 0.18).rotationEffect(.degrees(-25))
                Capsule().frame(width: size * 0.07, height: size * 0.18).rotationEffect(.degrees(-25))
            }
            .foregroundStyle(.black.opacity(0.82))
            .offset(x: size * 0.09, y: -size * 0.12)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct RoundedTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY + 2))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - 1, y: rect.maxY - 4),
                          control: CGPoint(x: rect.maxX + 2, y: rect.maxY - 1))
        path.addQuadCurve(to: CGPoint(x: rect.minX + 2, y: rect.maxY - 4),
                          control: CGPoint(x: rect.midX, y: rect.maxY + 1))
        path.addQuadCurve(to: CGPoint(x: rect.midX, y: rect.minY + 2),
                          control: CGPoint(x: rect.minX - 1, y: rect.maxY - 1))
        return path
    }
}
