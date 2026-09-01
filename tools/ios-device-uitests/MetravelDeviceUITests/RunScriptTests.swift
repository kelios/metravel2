import XCTest

/// Универсальный драйвер живого iPhone: сценарий приходит снаружи в QA_SCRIPT (JSON),
/// поэтому под каждый шаг приёмки НЕ надо перекомпилировать обвязку.
/// Приложение не пересобирается — тест цепляется к уже установленному бандлу.
final class RunScriptTests: XCTestCase {

    private var app: XCUIApplication!
    private var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

    override func setUp() {
        super.setUp()
        continueAfterFailure = true
        // Системные алерты (гео, фото, уведомления) не должны вешать прогон.
        addUIInterruptionMonitor(withDescription: "system-alert") { alert in
            for label in ["Разрешить", "Allow", "OK", "Не сейчас", "Not Now"] {
                let b = alert.buttons[label]
                if b.exists { b.tap(); return true }
            }
            return false
        }
    }

    func testRunScript() throws {
        let bundleId = env("QA_BUNDLE") ?? "by.metravel.app"
        app = XCUIApplication(bundleIdentifier: bundleId)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "приложение не вышло на передний план")

        let raw = env("QA_SCRIPT") ?? #"[{"op":"shot","name":"screen"}]"#
        print("QA-SCRIPT-RAW[\(raw.count)]: \(raw)")
        guard let steps = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]] else {
            XCTFail("QA_SCRIPT не разобрался как массив шагов"); return
        }

        for (i, step) in steps.enumerated() {
            let op = step["op"] as? String ?? ""
            let name = step["name"] as? String ?? "step\(i)"
            print("QA-STEP \(i) \(op) \(name)")
            switch op {
            case "wait":  Thread.sleep(forTimeInterval: step["sec"] as? Double ?? 1)
            case "shot":  shot(name)
            case "tree":  tree()
            case "tap":   tapPoint(step)
            case "tapId": tapQuery(app.descendants(matching: .any).matching(identifier: step["id"] as? String ?? ""), what: step["id"] as? String ?? "")
            case "tapText": tapText(step["text"] as? String ?? "")
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
        }
    }

    // MARK: - операции

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
    private func tapQuery(_ query: XCUIElementQuery, what: String) {
        guard query.count > 0 else { XCTFail("не найден элемент \(what)"); return }
        // Совпадений обычно несколько: Pressable-обёртка и её StaticText. Первый по индексу
        // бывает нетапабельным, поэтому берём первый ДОСТУПНЫЙ, а не первый попавшийся.
        for index in 0..<min(query.count, 8) {
            let candidate = query.element(boundBy: index)
            if candidate.isHittable { candidate.tap(); return }
        }
        let element = query.element(boundBy: 0)
        scrollTo(element)
        guard element.isHittable else {
            XCTFail("элемент \(what) есть в дереве, но не доступен для тапа"); return
        }
        element.tap()
    }

    /// Поле переживает предыдущий прогон: текст дописывается поверх и e-mail становится
    /// невалидным. Чистим посимвольно — «перезапустить приложение» дороже.
    private func clearField(_ text: String) {
        let q = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] %@", text))
        guard q.count > 0 else { XCTFail("не найдено поле \(text)"); return }
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
        let goDown = element.frame.minY >= app.frame.maxY
        for _ in 0..<25 {
            if element.isHittable { return }
            if goDown { scroller.swipeUp() } else { scroller.swipeDown() }
            Thread.sleep(forTimeInterval: 0.4)
        }
    }

    private func tapText(_ text: String) {
        let q = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS[c] %@ OR identifier CONTAINS[c] %@", text, text))
        tapQuery(q, what: text)
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
