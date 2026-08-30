import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "io.github.jeremylongshore.foundry"
  ipcTarget: "io.github.jeremylongshore.foundry"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property bool openedFromHotkey: false
  readonly property var barIdentity: hostWidget || root
  readonly property string helperPath: Qt.resolvedUrl("bin/omarchy-foundry").toString().replace(/^file:\/\//, "")
  property var receipt: Model.emptyReceipt()
  property bool loaded: false
  readonly property bool isAlert: receipt.ready && receipt.proof !== "READY"
  readonly property string label: Model.pillText(receipt)
  readonly property string tooltip: Model.tooltipText(receipt)
  readonly property color foundryBlue: "#77b8ff"
  readonly property color foundrySteel: "#354b66"
  readonly property color foundryInk: "#10151d"

  function open() {
    openedFromHotkey = false
    controller.show()
    refresh()
  }

  function openFromHotkey() {
    openedFromHotkey = true
    controller.show()
    refresh()
  }

  function close() { controller.hide() }
  function toggle() { if (opened) close(); else openFromHotkey() }
  function switchPanel(direction) {
    return bar && typeof bar.switchPanelFrom === "function"
      ? bar.switchPanelFrom(barIdentity, direction) : false
  }

  function refresh() {
    if (!doctor.running) doctor.running = true
  }

  Process {
    id: doctor
    command: [root.helperPath, "doctor", "--json"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.receipt = Model.parseReceipt(text)
        root.loaded = true
      }
    }
  }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.openFromHotkey() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): void {
      if (root.hostWidget && typeof root.hostWidget.broadcast === "function") root.hostWidget.broadcast("refresh")
      else root.refresh()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(680))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: contentColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        Column {
          id: contentColumn
          width: parent.width
          spacing: Style.space(10)

          PanelHero {
            title: "FORGE THE DRAFT. KEEP THE RECEIPT."
            meta: root.loaded ? root.receipt.message : "Reading the local Foundry boundary"
            foreground: root.bar ? root.bar.foreground : Color.foreground
            fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
            iconComponent: Component {
              Rectangle {
                width: Style.space(54)
                height: Style.space(54)
                radius: Style.cornerRadius
                color: root.foundryInk
                border.width: Style.space(2)
                border.color: root.foundryBlue
                Text {
                  anchors.centerIn: parent
                  text: "F"
                  textFormat: Text.PlainText
                  color: root.foundryBlue
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family
                  font.pixelSize: Style.font.display
                  font.bold: true
                }
              }
            }
          }

          PanelSeparator { foreground: root.bar ? root.bar.foreground : Color.foreground }

          Row {
            id: stageRow
            width: parent.width - Style.space(32)
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Style.space(8)

            Repeater {
              model: [
                { number: "01", title: "FORGE", detail: "Private staged tree" },
                { number: "02", title: "INSPECT", detail: "Copy, banner, tests, CI" },
                { number: "03", title: "PROVE", detail: "Real-shell evidence" }
              ]
              Rectangle {
                required property var modelData
                width: (stageRow.width - stageRow.spacing * 2) / 3
                height: Style.space(74)
                radius: Style.cornerRadius
                color: Qt.rgba(0.21, 0.29, 0.40, 0.22)
                opacity: 0.96
                border.width: 1
                border.color: Color.accent
                Text {
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(10)
                  anchors.top: parent.top
                  anchors.topMargin: Style.space(8)
                  width: parent.width - Style.space(20)
                  text: modelData.number + "  " + modelData.title
                  textFormat: Text.PlainText
                  elide: Text.ElideRight
                  color: root.foundryBlue
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family
                  font.pixelSize: Style.font.body
                  font.bold: true
                }
                Text {
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(10)
                  anchors.right: parent.right
                  anchors.rightMargin: Style.space(10)
                  anchors.bottom: parent.bottom
                  anchors.bottomMargin: Style.space(9)
                  text: modelData.detail
                  textFormat: Text.PlainText
                  elide: Text.ElideRight
                  color: root.bar ? Qt.darker(root.bar.foreground, 1.25) : Color.muted
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family
                  font.pixelSize: Style.font.bodySmall
                }
              }
            }
          }

          Column {
            width: parent.width
            spacing: Style.space(5)
            PanelSectionHeader {
              text: "PROOF RECEIPT"
              leftPadding: Style.space(16)
              foreground: root.bar ? root.bar.foreground : Color.foreground
              fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
            }
            Repeater {
              model: [
                { name: "Template", value: root.receipt.template || "Bundled bar widget" },
                { name: "Capabilities", value: root.receipt.capabilities || "No project selected" },
                { name: "Proof", value: root.receipt.proof || "UNPROVEN" }
              ]
              Rectangle {
                required property var modelData
                width: contentColumn.width
                height: Style.space(22)
                color: "transparent"
                opacity: 1
                border.width: 0
                border.color: Color.accent
                Text {
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(16)
                  anchors.verticalCenter: parent.verticalCenter
                  text: modelData.name
                  textFormat: Text.PlainText
                  width: parent.width * 0.35
                  elide: Text.ElideRight
                  color: root.bar ? root.bar.foreground : Color.foreground
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family
                  font.pixelSize: Style.font.body
                }
                Text {
                  anchors.right: parent.right
                  anchors.rightMargin: Style.space(16)
                  anchors.verticalCenter: parent.verticalCenter
                  text: modelData.value
                  textFormat: Text.PlainText
                  width: parent.width * 0.6
                  horizontalAlignment: Text.AlignRight
                  elide: Text.ElideLeft
                  color: root.bar ? Qt.darker(root.bar.foreground, 1.3) : Color.muted
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family
                  font.pixelSize: Style.font.bodySmall
                }
              }
            }
          }

          Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width - Style.space(32)
            height: commandColumn.implicitHeight + Style.space(20)
            radius: Style.cornerRadius
            color: root.foundryInk
            border.width: 1
            border.color: root.foundrySteel

            Column {
              id: commandColumn
              anchors.left: parent.left
              anchors.leftMargin: Style.space(12)
              anchors.right: parent.right
              anchors.rightMargin: Style.space(12)
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(4)
              Text {
                text: "SAFE START · DRY RUN"
                textFormat: Text.PlainText
                color: root.foundryBlue
                font.family: root.bar ? root.bar.fontFamily : Style.font.family
                font.pixelSize: Style.font.bodySmall
                font.bold: true
                font.letterSpacing: 1
              }
              Text {
                width: parent.width
                text: "omarchy-foundry create --workspace PATH --id io.github.you.widget --name NAME --description-file COPY.txt --dry-run"
                textFormat: Text.PlainText
                wrapMode: Text.Wrap
                color: root.bar ? root.bar.foreground : Color.foreground
                font.family: root.bar ? root.bar.fontFamily : Style.font.family
                font.pixelSize: Style.font.bodySmall
              }
              Text {
                width: parent.width
                text: "No install · no Git write · no network · no publication"
                textFormat: Text.PlainText
                elide: Text.ElideRight
                color: root.bar ? Qt.darker(root.bar.foreground, 1.3) : Color.muted
                font.family: root.bar ? root.bar.fontFamily : Style.font.family
                font.pixelSize: Style.font.bodySmall
              }
            }
          }

          Item { width: 1; height: Style.space(6) }
        }
      }
    }
  }
}
