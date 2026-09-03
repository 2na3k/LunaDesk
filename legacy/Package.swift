// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "LunaDesk",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "LunaDesk", targets: ["LunaDesk"])
    ],
    targets: [
        .executableTarget(name: "LunaDesk"),
        .testTarget(name: "LunaDeskTests", dependencies: ["LunaDesk"])
    ]
)
