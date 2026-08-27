// sliceui OCR — macOS Vision framework text recognition.
// Compiled at runtime by transcribe-static via `swiftc` (zero npm deps).
// Reads an image path, prints JSON lines: { "text": "...", "x": , "y": , "w": , "h":  }
// Coordinates are pixel-space, top-left origin, matching the transcript schema.

import Foundation
import Vision
import AppKit

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: ocr <image-path>") }

let imagePath = args[1]
guard let image = NSImage(contentsOfFile: imagePath), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fail("cannot read image: \(imagePath)")
}

let width = cg.width
let height = cg.height

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en"]
request.usesLanguageCorrection = false

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
do {
    try handler.perform([request])
} catch {
    fail("vision failed: \(error)")
}

guard let observations = request.results, !observations.isEmpty else {
    print("[]")
    exit(0)
}

var lines: [String] = []
for obs in observations {
    guard let candidate = obs.topCandidates(1).first else { continue }
    // Vision box: normalized, origin bottom-left. Convert to top-left pixel space.
    let box = obs.boundingBox
    let x = box.origin.x * Double(width)
    let h = box.size.height * Double(height)
    let y = Double(height) - box.origin.y * Double(height) - h
    let w = box.size.width * Double(width)
    let text = candidate.string.replacingOccurrences(of: "\"", with: "'")
    lines.append(String(format: "{\"text\":\"%@\",\"x\":%.0f,\"y\":%.0f,\"w\":%.0f,\"h\":%.0f}", text, x, y, w, h))
}
print("[" + lines.joined(separator: ",") + "]")
