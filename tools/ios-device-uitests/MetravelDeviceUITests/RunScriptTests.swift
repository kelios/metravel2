import XCTest
import UIKit
import CryptoKit

/// Универсальный драйвер живого iPhone: сценарий приходит снаружи в QA_SCRIPT (JSON),
/// поэтому под каждый шаг приёмки НЕ надо перекомпилировать обвязку.
/// Приложение не пересобирается — тест цепляется к уже установленному бандлу.
final class RunScriptTests: XCTestCase {

    private var app: XCUIApplication!
    private var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }
    private var secretPasteboardChangeCount: Int?
    private var isPrivateInput: Bool { env("QA_PRIVATE_INPUT") == "1" }

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        // Permission matrix требует явного выбора: не регистрируем auto-dismiss monitor.
    }

    override func tearDown() {
        clearSecretClipboard()
        super.tearDown()
    }

    override func record(_ issue: XCTIssue) {
        guard isPrivateInput else { super.record(issue); return }
        super.record(XCTIssue(
            type: issue.type,
            compactDescription: "Private input step failed; details suppressed",
            detailedDescription: nil,
            sourceCodeContext: issue.sourceCodeContext,
            associatedError: nil,
            attachments: []
        ))
    }

    func testRunScript() throws {
        // Legacy screenshot-only callers must opt in explicitly. A missing dispatch
        // must never turn an assertion-bearing rehearsal into a successful screenshot.
        guard let raw = env("QA_SCRIPT") ?? (env("QA_LEGACY_SHOT") == "1" ? #"[{"op":"shot","name":"screen"}]"# : nil) else {
            XCTFail("Missing QA_SCRIPT dispatch"); return
        }
        guard let steps = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]] else {
            XCTFail("QA_SCRIPT не разобрался как массив шагов"); return
        }

        guard validate(steps) else { return }
        let bundleId = env("QA_BUNDLE") ?? "by.metravel.app"
        app = XCUIApplication(bundleIdentifier: bundleId)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15), "приложение не вышло на передний план")

        var completedSteps = 0
        var completedAssertions = 0
        for (i, step) in steps.enumerated() {
            let op = step["op"] as? String ?? ""
            let name = step["name"] as? String ?? "step\(i)"
            if isPrivateInput {
                guard !["shot", "tree", "type", "typePlaceholder", "clear"].contains(op) else {
                    XCTFail("Операция запрещена в QA_PRIVATE_INPUT"); return
                }
                print("QA-STEP \(i)")
            } else {
                print("QA-STEP \(i) \(op) \(name)")
            }
            switch op {
            case "wait":  Thread.sleep(forTimeInterval: step["sec"] as? Double ?? 1)
            case "shot":  shot(name)
            case "tree":  tree()
            case "tap":   tapPoint(step)
            case "tapId": tapQuery(app.descendants(matching: .any).matching(identifier: step["id"] as? String ?? ""), what: step["id"] as? String ?? "", timeout: step["timeout"] as? Double ?? 10)
            case "tapText": tapText(step["text"] as? String ?? "", timeout: step["timeout"] as? Double ?? 10)
            case "assert": assertState(step, timeout: 0)
            case "waitUntil": assertState(step, timeout: step["timeout"] as? Double ?? 10)
            case "longPressText": longPressText(step["text"] as? String ?? "", duration: step["sec"] as? Double ?? 1.2)
            case "longPressPlaceholder": longPressPlaceholder(step["placeholder"] as? String ?? "", duration: step["sec"] as? Double ?? 1.2)
            case "tapSystemAlertButton": tapSystemAlertButton(step)
            case "secretClipboard": stageSecretClipboard(key: step["key"] as? String ?? "")
            case "clearSecretClipboard": clearSecretClipboard()
            case "ensureSwitch": ensureSwitch(id: step["id"] as? String ?? "", on: (step["on"] as? Bool) ?? true)
            case "typePlaceholder": typePlaceholder(step["placeholder"] as? String ?? "", text: step["text"] as? String ?? "")
            case "swipe": swipe(step)
            case "type":  app.typeText(step["text"] as? String ?? "")
            // Форма связана returnKeyType="next"/onSubmitEditing: переход по полям клавишей
            // надёжнее тапа — клавиатура закрывает нижние поля и делает их неhittable.
            case "return": app.typeText("\n")
            case "clear": clearField(step["text"] as? String ?? "")
            case "dismissKeyboard": dismissKeyboard()
            case "home":  XCUIDevice.shared.press(.home)
            case "activate": app.activate()
            case "terminate": app.terminate()
            default: XCTFail("неизвестная операция \(op)")
            }
            completedSteps += 1
            if ["assert", "waitUntil"].contains(op) { completedAssertions += 1 }
        }
        // Only successful execution reaches this receipt. Never include raw script,
        // input values, device/account identifiers or accessibility output.
        let receipt: [String: Any] = [
            "schemaVersion": 1,
            "scriptSha256": SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined(),
            "completedSteps": completedSteps,
            "completedAssertions": completedAssertions
        ]
        let receiptData = try JSONSerialization.data(withJSONObject: receipt, options: [.sortedKeys])
        print("QA-COMPLETE " + String(decoding: receiptData, as: UTF8.self))
    }

    // Validate the complete script before activating an installed application. The host
    // validates the same public contract, but runtime xctestrun callers cannot bypass it.
    private func validate(_ steps: [[String: Any]]) -> Bool {
        let required: [String: [String]] = [
            "wait": ["sec"], "shot": [], "tree": [], "tap": ["x", "y"], "tapId": ["id"],
            "tapText": ["text"], "longPressText": ["text"], "longPressPlaceholder": ["placeholder"],
            "tapSystemAlertButton": ["alertText", "button"], "secretClipboard": ["key"], "clearSecretClipboard": [],
            "ensureSwitch": ["id", "on"], "typePlaceholder": ["placeholder", "text"], "swipe": ["dir"],
            "type": ["text"], "return": [], "clear": ["text"], "dismissKeyboard": [], "home": [],
            "activate": [], "terminate": [], "assert": ["state"], "waitUntil": ["state"]
        ]
        guard !steps.isEmpty, steps.count <= 200 else { XCTFail("Expected 1..200 steps"); return false }
        for step in steps {
            guard let op = step["op"] as? String, let keys = required[op], keys.allSatisfy({ step[$0] != nil }) else {
                XCTFail("Unknown operation or missing required field"); return false
            }
            if let on = step["on"], !(on is Bool) {
                XCTFail("Switch state must be boolean"); return false
            }
            if let dir = step["dir"], !(dir is String && ["up", "down", "left", "right"].contains(dir as! String)) {
                XCTFail("Invalid swipe direction"); return false
            }
            if op == "secretClipboard" {
                guard isPrivateInput, let key = step["key"] as? String,
                      key.range(of: #"^[A-Za-z0-9_-]{1,64}$"#, options: .regularExpression) != nil else {
                    XCTFail("Secret clipboard requires private input and an opaque key"); return false
                }
            }
            for key in ["id", "text", "placeholder", "alertText", "button", "key"] where step[key] != nil {
                guard let value = step[key] as? String, !value.isEmpty, value.count <= 4096 else {
                    XCTFail("Invalid string field"); return false
                }
            }
            if let name = step["name"] {
                guard let value = name as? String, value.range(of: #"^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$"#, options: .regularExpression) != nil else {
                    XCTFail("Unsafe attachment name"); return false
                }
            }
            for key in ["sec", "timeout", "x", "y"] where step[key] != nil {
                guard let value = step[key] as? Double, value.isFinite, value >= 0,
                      value <= (["x", "y"].contains(key) ? 4096 : 30), !(op == "wait" && value > 5) else {
                    XCTFail("Invalid bounded numeric field"); return false
                }
            }
            if ["assert", "waitUntil"].contains(op) {
                guard (step["id"] != nil) != (step["text"] != nil),
                      let state = step["state"] as? String, ["exists", "absent", "hittable", "value", "count"].contains(state),
                      state != "value" || step["value"] is String,
                      state != "count" || ((step["count"] as? Int).map { (0...100).contains($0) } ?? false) else {
                    XCTFail("Invalid assertion selector/state"); return false
                }
            }
            if isPrivateInput && ["shot", "tree", "type", "typePlaceholder", "clear", "assert", "waitUntil"].contains(op) {
                XCTFail("Operation disabled in private input"); return false
            }
        }
        return true
    }

    private func query(_ step: [String: Any]) -> XCUIElementQuery {
        if let id = step["id"] as? String { return app.descendants(matching: .any).matching(identifier: id) }
        return app.staticTexts.matching(NSPredicate(format: "label == %@", step["text"] as? String ?? ""))
    }

    private func stateMatches(_ step: [String: Any]) -> Bool {
        let matches = query(step)
        let count = matches.count
        switch step["state"] as? String {
        case "absent": return count == 0
        case "count": return count == (step["count"] as? Int)
        case "exists": return count == 1
        case "hittable": return count == 1 && matches.element(boundBy: 0).isHittable
        case "value": return count == 1 && (matches.element(boundBy: 0).value as? String) == (step["value"] as? String)
        default: return false
        }
    }

    private func assertState(_ step: [String: Any], timeout: TimeInterval) {
        if stateMatches(step) { return }
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in self.stateMatches(step) }, object: nil)
        guard timeout > 0, XCTWaiter.wait(for: [ready], timeout: timeout) == .completed else {
            XCTFail("Expected exact selector state: \(step["state"] as? String ?? "unknown")"); return
        }
    }

    // MARK: - операции

    /// Только opaque key попадает в QA_SCRIPT. Значение не передаётся в XCTest typeText.
    /// Перед настоящими credentials обязателен dummy-canary + keepNever в xctestrun.
    private func stageSecretClipboard(key: String) {
        guard isPrivateInput, key.range(of: #"^[A-Za-z0-9_-]{1,64}$"#, options: .regularExpression) != nil else {
            XCTFail("Для secretClipboard нужны QA_PRIVATE_INPUT=1 и допустимый ключ"); return
        }
        let directory = docs.appendingPathComponent("qa-secret-input", isDirectory: true)
        let file = directory.appendingPathComponent(key + ".txt")
        guard file.resolvingSymlinksInPath().deletingLastPathComponent() == directory.resolvingSymlinksInPath() else {
            XCTFail("Недопустимый путь приватного файла"); return
        }
        do {
            let data = try Data(contentsOf: file)
            try FileManager.default.removeItem(at: file)
            guard !data.isEmpty, data.count <= 16384, let value = String(data: data, encoding: .utf8) else {
                XCTFail("Ожидается непустой UTF-8 приватный файл до 16 KiB"); return
            }
            onMain {
                UIPasteboard.general.setItems([["public.utf8-plain-text": value]], options: [
                    .localOnly: true, .expirationDate: Date().addingTimeInterval(60)
                ])
                secretPasteboardChangeCount = UIPasteboard.general.changeCount
            }
        } catch {
            // Не печатаем error: он может содержать путь или данные.
            try? FileManager.default.removeItem(at: file)
            XCTFail("Не удалось прочитать и удалить приватный файл")
        }
    }

    private func clearSecretClipboard() {
        guard let expectedChangeCount = secretPasteboardChangeCount else { return }
        onMain {
            if UIPasteboard.general.changeCount == expectedChangeCount {
                UIPasteboard.general.items = []
            }
        }
        secretPasteboardChangeCount = nil
    }

    private func onMain(_ action: () -> Void) {
        if Thread.isMainThread { action() } else { DispatchQueue.main.sync(execute: action) }
    }

    private func tapSystemAlertButton(_ step: [String: Any]) {
        guard let text = step["alertText"] as? String, !text.isEmpty,
              let label = step["button"] as? String, !label.isEmpty else {
            XCTFail("Нужны ожидаемый alertText и точная подпись button"); return
        }
        let alerts = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts
        guard alerts.count == 1 else { XCTFail("Ожидается один системный alert"); return }
        let alert = alerts.element(boundBy: 0)
        guard alert.label.contains(text) || alert.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).count > 0 else {
            XCTFail("Системный alert не соответствует ожидаемому"); return
        }
        let buttons = alert.buttons.matching(NSPredicate(format: "label == %@", label))
        guard buttons.count == 1, buttons.element(boundBy: 0).isHittable else {
            XCTFail("Нет единственной доступной кнопки системного alert"); return
        }
        buttons.element(boundBy: 0).tap()
    }

    private func longPressPlaceholder(_ placeholder: String, duration: TimeInterval) {
        guard !placeholder.isEmpty else { XCTFail("Нужен placeholder поля"); return }
        let fields = app.descendants(matching: .any).matching(NSPredicate(
            format: "(elementType == %d OR elementType == %d) AND placeholderValue == %@",
            XCUIElement.ElementType.textField.rawValue, XCUIElement.ElementType.secureTextField.rawValue, placeholder
        ))
        guard fields.count == 1 else { XCTFail("Ожидается единственное поле с placeholder"); return }
        let field = fields.element(boundBy: 0)
        scrollTo(field)
        guard field.isHittable else { XCTFail("Поле недоступно для long-press"); return }
        field.press(forDuration: duration)
    }

    private func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let att = XCTAttachment(screenshot: screenshot)
        att.name = name
        att.lifetime = .keepAlways
        add(att)
        // Дубль файлом: xcresult вытаскивать дороже, чем забрать PNG из контейнера раннера.
        try? screenshot.pngRepresentation.write(to: docs.appendingPathComponent("\(name).png"))
        print("QA-SHOT \(name)")
    }

    /// Дерево печатается в stdout — оно приезжает прямо в вывод xcodebuild, экспорт не нужен.
    private func tree() {
        print("QA-TREE-BEGIN")
        print(app.debugDescription)
        print("QA-TREE-END")
    }

    private func tapPoint(_ step: [String: Any]) {
        let x = step["x"] as? Double ?? 0, y = step["y"] as? Double ?? 0
        app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            .withOffset(CGVector(dx: x, dy: y)).tap()
    }

    /// Предикатный запрос: `.firstMatch.exists` БРОСАЕТ на пустом результате — сначала count.
    /// Элемент в длинной странице обычно ЕСТЬ в дереве, но лежит вне экрана: тап по нему
    /// падает с «Failed to synthesize event», поэтому сначала доскролливаем до hittable.
    private func tapQuery(_ query: XCUIElementQuery, what: String, timeout: TimeInterval = 10) {
        let present = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in query.count > 0 }, object: nil)
        guard query.count > 0 || XCTWaiter.wait(for: [present], timeout: timeout) == .completed else {
            XCTFail("Exact selector not found: \(what)"); return
        }
        guard query.count == 1 else { XCTFail("Ambiguous exact selector: \(what)"); return }
        let element = query.element(boundBy: 0)
        scrollTo(element)
        let hittable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in element.isHittable }, object: nil)
        guard element.isHittable || XCTWaiter.wait(for: [hittable], timeout: timeout) == .completed else {
            XCTFail("Element is not hittable: \(what)"); return
        }
        element.tap()
    }

    /// Поле переживает предыдущий прогон: текст дописывается поверх и e-mail становится
    /// невалидным. Чистим посимвольно — «перезапустить приложение» дороже.
    private func clearField(_ text: String) {
        let q = app.descendants(matching: .any).matching(NSPredicate(
            format: "(elementType == %d OR elementType == %d) AND (identifier == %@ OR label == %@)",
            XCUIElement.ElementType.textField.rawValue, XCUIElement.ElementType.secureTextField.rawValue, text, text))
        guard q.count == 1 else { XCTFail("Expected one exact field"); return }
        let element = q.element(boundBy: 0)
        scrollTo(element)
        guard element.isHittable else { XCTFail("поле \(text) недоступно для очистки"); return }
        element.tap()
        let current = (element.value as? String) ?? ""
        if !current.isEmpty {
            element.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + 5))
        }
    }

    /// Клавиатура занимает низ экрана и делает чекбокс согласия и кнопку отправки
    /// неhittable — их не «не видно», их физически нечем нажать. Гасим тапом по верху
    /// страницы: свайп по окну RN-клавиатуру не убирает.
    private func dismissKeyboard() {
        guard app.keyboards.count > 0 else { return }
        // Тап должен попасть в ФОН списка (keyboardShouldPersistTaps="handled"), а не в шапку:
        // keyboardDismissMode="none", поэтому свайпом клавиатуру не убрать вообще.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.27)).tap()
        Thread.sleep(forTimeInterval: 1.0)
        if app.keyboards.count > 0 {
            let scroller: XCUIElement = app.scrollViews.count > 0 ? app.scrollViews.element(boundBy: 0) : app!
            scroller.swipeDown()
            Thread.sleep(forTimeInterval: 1.0)
        }
        print("QA-KEYBOARD \(app.keyboards.count > 0 ? "всё ещё открыта" : "закрыта")")
    }

    /// Направление подбираем по геометрии, а не наугад: у RN-страницы координаты элемента
    /// абсолютные по контенту, поэтому «ниже экрана» = frame.minY больше нижней границы окна.
    /// Свайпать надо по самому списку — свайп по всему окну попадает в горизонтальные ленты.
    private func scrollTo(_ element: XCUIElement) {
        if element.isHittable { return }
        let scroller: XCUIElement = app.scrollViews.count > 0 ? app.scrollViews.element(boundBy: 0) : app!
        for _ in 0..<3 {
            if element.isHittable { return }
            if element.frame.minY >= app.frame.maxY { scroller.swipeUp() } else { scroller.swipeDown() }
        }
    }

    private func tapText(_ text: String, timeout: TimeInterval) {
        let q = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@ OR identifier == %@", text, text))
        tapQuery(q, what: text, timeout: timeout)
    }

    private func longPressText(_ text: String, duration: TimeInterval) {
        let q = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@ OR identifier == %@", text, text))
        guard q.count == 1 else { XCTFail("Expected one exact long-press target"); return }
        let element = q.element(boundBy: 0)
        scrollTo(element)
        guard element.isHittable else {
            XCTFail("элемент \(text) есть в дереве, но не доступен для long-press"); return
        }
        element.press(forDuration: duration)
    }

    private func ensureSwitch(id: String, on: Bool) {
        let switches = app.switches.matching(identifier: id)
        let fallback = app.descendants(matching: .any).matching(identifier: id)
        let query = switches.count > 0 ? switches : fallback
        guard query.count == 1 else { XCTFail("Expected one exact switch"); return }
        let element = query.element(boundBy: 0)
        scrollTo(element)
        guard element.isHittable else {
            XCTFail("переключатель \(id) есть в дереве, но не доступен для тапа"); return
        }
        let raw = ((element.value as? String) ?? "").lowercased()
        guard ["1", "true", "on", "0", "false", "off"].contains(raw) else {
            XCTFail("Switch has no recognized accessibility state"); return
        }
        let isOn = raw == "1" || raw == "true" || raw == "on"
        print("QA-SWITCH \(id) value=\(raw) wantOn=\(on)")
        if isOn != on { element.tap() }
        let expected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let value = ((element.value as? String) ?? "").lowercased()
            return (on ? ["1", "true", "on"] : ["0", "false", "off"]).contains(value)
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [expected], timeout: 5), .completed, "Switch state did not change")
    }

    private func typePlaceholder(_ placeholder: String, text: String) {
        let predicate = NSPredicate(
            format: "(elementType == %d OR elementType == %d) AND placeholderValue == %@",
            XCUIElement.ElementType.textField.rawValue, XCUIElement.ElementType.secureTextField.rawValue,
            placeholder
        )
        let fields = app.descendants(matching: .any).matching(predicate)
        guard fields.count == 1 else { XCTFail("Expected one exact placeholder field"); return }
        let field = fields.element(boundBy: 0)
        scrollTo(field)
        guard field.isHittable else {
            XCTFail("поле \(placeholder) недоступно для ввода"); return
        }
        field.tap()
        let current = (field.value as? String) ?? ""
        if !current.isEmpty && current.lowercased() != placeholder.lowercased() {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count + 5))
        }
        field.typeText(text)
    }

    private func swipe(_ step: [String: Any]) {
        let dir = step["dir"] as? String ?? "up"
        switch dir {
        case "down":  app.swipeDown()
        case "left":  app.swipeLeft()
        case "right": app.swipeRight()
        default:      app.swipeUp()
        }
    }

    private func env(_ key: String) -> String? {
        let v = ProcessInfo.processInfo.environment[key]
        return (v?.isEmpty ?? true) ? nil : v
    }
}
