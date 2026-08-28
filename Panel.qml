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
    contentWidth: panel.fittedContentWidth(Style.space(440))
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

          Column {
            width: parent.width
            spacing: Style.space(4)
            Text {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(16)
              text: "FOUNDRY"
              textFormat: Text.PlainText
              color: root.bar ? root.bar.foreground : Color.foreground
              font.family: root.bar ? root.bar.fontFamily : Style.font.family
              font.pixelSize: Style.font.title
              font.bold: true
              font.letterSpacing: 1
            }
            Text {
              anchors.left: parent.left
              anchors.leftMargin: Style.space(16)
              width: parent.width - Style.space(32)
              text: root.loaded ? root.receipt.message : "Reading local Foundry status"
              textFormat: Text.PlainText
              elide: Text.ElideRight
              color: root.bar ? Qt.darker(root.bar.foreground, 1.3) : Color.muted
              font.family: root.bar ? root.bar.fontFamily : Style.font.family
              font.pixelSize: Style.font.bodySmall
            }
          }

          PanelSeparator { foreground: root.bar ? root.bar.foreground : Color.foreground }

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
              Item {
                required property var modelData
                width: contentColumn.width
                height: Style.space(22)
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

          Text {
            anchors.left: parent.left
            anchors.leftMargin: Style.space(16)
            width: parent.width - Style.space(32)
            text: "Create a draft with: omarchy-foundry create --workspace PATH --id io.github.you.widget --name NAME --description TEXT --dry-run"
            textFormat: Text.PlainText
            wrapMode: Text.Wrap
            color: root.bar ? Qt.darker(root.bar.foreground, 1.3) : Color.muted
            font.family: root.bar ? root.bar.fontFamily : Style.font.family
            font.pixelSize: Style.font.bodySmall
          }

          Item { width: 1; height: Style.space(6) }
        }
      }
    }
  }
}
