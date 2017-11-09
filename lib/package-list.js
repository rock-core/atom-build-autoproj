'use babel';

import { SelectListView } from 'atom-space-pen-views'

export default class PackageList extends SelectListView {

  constructor() {
    super(...arguments);
    this.show();
  }

  initialize() {
    super.initialize(...arguments);
    this.addClass('package-list');
    this.list.addClass('mark-active');
  }

  show() {
    this.panel = atom.workspace.addModalPanel({ item: this });
    this.panel.show();
    this.focusFilterEditor();
  }

  hide() {
    this.panel.hide();
  }

  setItems() {
    super.setItems(...arguments);

    const activeItemView = this.find('.active');
    if (0 < activeItemView.length) {
      this.selectItemView(activeItemView);
      this.scrollToItemView(activeItemView);
    }
  }

  setActivePackage(packageName) {
    this.activePackage = packageName;
  }

  viewForItem(packageName) {
    const activePackage = this.activePackage;
    return PackageList.render(function () {
      const activeClass = (packageName === activePackage ? 'active' : '');
      this.li({ class: activeClass + ' package-list' }, packageName);
    });
  }

  getEmptyMessage(itemCount) {
    return 'No matches';
  }

  awaitSelection() {
    return new Promise((resolve, reject) => {
      this.resolveFunction = resolve;
    });
  }

  confirmed(packageName) {
    if (this.resolveFunction) {
      this.resolveFunction(packageName);
      this.resolveFunction = null;
    }
    this.hide();
  }

  cancelled() {
    this.hide();
  }
}
