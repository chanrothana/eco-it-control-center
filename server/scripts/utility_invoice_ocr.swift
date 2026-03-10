import Foundation
import Vision
import ImageIO

struct OCRResult: Codable {
  let text: String
  let lines: [String]
}

enum OCRScriptError: Error {
  case missingPath
  case unreadableImage
}

func run() throws {
  guard CommandLine.arguments.count > 1 else {
    throw OCRScriptError.missingPath
  }

  let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
  guard
    let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
    let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw OCRScriptError.unreadableImage
  }

  var recognizedLines: [String] = []
  let request = VNRecognizeTextRequest { request, error in
    if let error {
      fputs("OCR failed: \(error.localizedDescription)\n", stderr)
      return
    }
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
      return
    }
    for observation in observations {
      guard let best = observation.topCandidates(1).first else { continue }
      let text = best.string.trimmingCharacters(in: .whitespacesAndNewlines)
      if !text.isEmpty {
        recognizedLines.append(text)
      }
    }
  }
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["en-US", "fr-FR"]

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try handler.perform([request])

  let result = OCRResult(
    text: recognizedLines.joined(separator: "\n"),
    lines: recognizedLines
  )
  let data = try JSONEncoder().encode(result)
  FileHandle.standardOutput.write(data)
}

do {
  try run()
} catch OCRScriptError.missingPath {
  fputs("Image path argument is required.\n", stderr)
  exit(2)
} catch OCRScriptError.unreadableImage {
  fputs("Could not read the invoice image.\n", stderr)
  exit(3)
} catch {
  fputs("\(error.localizedDescription)\n", stderr)
  exit(1)
}
