define(['js/ui/View', 'js/core/Bindable', 'js/core/List', 'js/data/Collection', 'underscore'], function (View, Bindable, List, Collection, _) {
    var SELECTION_MODE_NONE = 'none',
        SELECTION_MODE_MULTI = 'multi',
        SELECTION_MODE_SINGLE = 'single';

    /***
     * defines an ItemsView which can show parts of data
     */
    var VirtualItemsView = View.inherit('js.ui.VirtualItemsView', {

        defaults: {

            // the data, which should be bound
            data: null,
            // TODO: update positions, after DOM Element scrollLeft and scrollTop changed
            // scroll positions
            scrollTop: 0,
            scrollLeft: 0,

            // TODO: update width and height, after DOM Element resized
            width: 300,
            height: 300,

            itemWidth: 100,
            itemHeight: 100,

            rows: 3,
            cols: 3,
            scrollToIndex: 0,
            horizontalGap: 0,
            verticalGap: 0,

            prefetchItemCount: 0,

            fetchPageDelay: 500,

            $dataAdapter: null,
            selectionMode: 'multi',
            selectedItems: List
        },
        $classAttributes: ['scrollToIndex','selectionMode','selectedItems','data','horizontalGap', 'verticalGap', 'prefetchItemCount', 'rows', 'cols', 'itemWidth', 'itemHeight', 'scrollLeft', 'scrollTop', 'fetchPageDelay'],
        events: ["on:itemClick", "on:itemDblClick"],
        ctor: function () {
            this.$currentSelectionIndex = null;
            this.$selectionMap = {};
            this.$selectedViews = {};
            this.$activeRenderer = {};
            this.$availableRenderer = [];
            this.$container = null;

            this.callBase();

            this.createBinding('{$dataAdapter.size()}', this._itemsCountChanged, this);
            this.bind('change:scrollTop', this._updateVisibleItems, this);
            this.bind('change:scrollLeft', this._updateVisibleItems, this);
            this.bind('change:height', this._updateVisibleItems, this);
            this.bind('change:width', this._updateVisibleItems, this);

        },
        _initializeRenderer: function ($el) {
            var style = $el.getAttribute('style') || "";
            style = style.split(";");
            style.push('overflow: auto');
            $el.setAttribute('style', style.join(";"));
        },
        _onDomAdded: function(){
            this.callBase();
            if(this.isRendered()){
                this._syncScrollPosition();
            }
        },
        _syncScrollPosition: function(){
            this.$el.scrollTop = this.$.scrollTop;
            this.$el.scrollLeft = this.$.scrollLeft;
        },
        _bindDomEvents: function (el) {
            this.callBase();
            var self = this;

            this.bindDomEvent('scroll', function (e) {
                self.set({
                    scrollTop: self.$el.scrollTop,
                    scrollLeft: self.$el.scrollLeft
                });
            });
        },

        _initializationComplete: function() {
            this.callBase();
            this.$container = this._getScrollContainer();
            this._commitData(this.$.data);
        },
        _commitData: function (data) {
            if (!this.$initialized) {
                return;
            }
            this.set('$dataAdapter', VirtualItemsView.createDataAdapter(data, this));
            this._updateVisibleItems();
        },
        _commitChangedAttributes: function(attributes, opt){
            if(!_.isUndefined(attributes.scrollToIndex) && opt.initiator !== this){
                // TODO: add scroll left handling
                var scrollTop = this.getPointFromIndex(attributes.scrollToIndex).y;
                if(this.isRendered()){
                    this.$el.scrollTop = scrollTop;
                }else{
                    this.set('scrollTop', scrollTop);
                }
            }
            this.callBase();

            // TODO data provider change
            // TODO: cleanup renderer
        },
        _updateVisibleItems: function () {
            var dataAdapter = this.$.$dataAdapter;
            if (!dataAdapter) {
                return;
            }
            // check if some renderers can be released
            var scrollLeft = this.$.scrollLeft,
                scrollTop = this.$.scrollTop,
                realStartIndex = this.getIndexFromPoint(scrollLeft, scrollTop),
                startIndex = realStartIndex - this.$.prefetchItemCount,
                endIndex = this.getIndexFromPoint(scrollLeft + this.$.width, scrollTop + this.$.height) + this.$.prefetchItemCount,
                renderer, i, pageIndex;

            realStartIndex = Math.max(0, realStartIndex);
            this.set('scrollToIndex', realStartIndex, {initiator: this});

            startIndex = Math.max(0, startIndex);
            var ItemsCount = parseFloat(dataAdapter.size());

            if (!isNaN(ItemsCount)) {
                // end well known
                endIndex = Math.min(ItemsCount, endIndex)
            }

            if (!(startIndex === this.$lastStartIndex && endIndex === this.$lastEndIndex)) {


                // some items are not visible any more or scrolled into view
                // remember the last
                this.$lastStartIndex = startIndex;
                this.$lastEndIndex = endIndex;

                // release unused renderer
                for (var index in this.$activeRenderer) {
                    if (this.$activeRenderer.hasOwnProperty(index) && (index < startIndex || index > endIndex)) {
                        // render not in use
                        renderer = this.$activeRenderer[index];
                        if (renderer) {
                            renderer.set({
                                $index: null,
                                $dataItem: null
                            });

                            renderer.remove();

                            this.$availableRenderer.push(renderer);
                        }

                        delete this.$activeRenderer[index];
                    }
                }

                var addedRenderer = [];

                for (i = startIndex; i <= endIndex; i++) {
                    renderer = this.$activeRenderer[i];

                    if (!renderer) {
                        // no renderer assigned to this item
                        renderer = this._reserveRenderer();
                        this.$activeRenderer[i] = renderer;
                        renderer.set({
                            width: this.$.itemWidth,
                            height: this.$.itemHeight,
                            $dataItem: dataAdapter.getItemAt(i),
                            $index: i,
                            $viewIndex: i - startIndex
                        });
                        this._addRenderer(renderer, renderer.$.$viewIndex);
                        addedRenderer.push(renderer);
                    }
                }

                for (i = 0; i < addedRenderer.length; i++) {
                    this._positionRenderer(addedRenderer[i], addedRenderer);
                }

                this._onVisibleItemsUpdated(startIndex, endIndex);

            }


        },
        /***
         * @abstract
         * @param startIndex
         * @param endIndex
         * @private
         */
        _onVisibleItemsUpdated: function(startIndex, endIndex){
            // HOOK for positions containers
        },
        _addRenderer: function (renderer, pos) {
            this.$container.addChild(renderer, {childIndex: pos});
        },

        _positionRenderer: function (renderer, addedRenderer) {
            var point = this.getPointFromIndex(renderer.$.$index);
            renderer.set({
                left: point.x,
                top: point.y
            });
        },

        _reserveRenderer: function () {
            if (this.$availableRenderer.length) {
                return this.$availableRenderer.pop();
            }
            var renderer = this._createRenderer();
            renderer.bind('on:dblclick',this._onRendererDblClick, this);
            renderer.bind('on:click',this._onRendererClick, this);
            return renderer;
        },
        _onRendererClick: function (e, renderer) {
            this.trigger('on:itemClick', e, renderer);
            if(!e.isDefaultPrevented){
                this._selectItem(renderer.$.$index, e.domEvent.shiftKey, e.domEvent.metaKey);
            }
        },
        _onRendererDblClick: function (e, renderer) {
            this.trigger('on:itemDblClick', e, renderer);
        },
        _createRenderer: function (attributes) {
            return this.$templates['renderer'].createComponents(attributes, this)[0];
        },
        _renderItemWidth: function(itemWidth){
            for(var index in this.$activeRenderer){
                if(this.$activeRenderer.hasOwnProperty(index)){
                    this.$activeRenderer[index].set('width', itemWidth);
                    this._positionRenderer(this.$activeRenderer[index],[]);
                }
            }
            // this._updateVisibleItems();
        },
        _itemsCountChanged: function () {
            var size = this.getSizeForItemsCount(this.$.$dataAdapter.size());
            if (size) {
                this._getScrollContainer().set(size);
                this._syncScrollPosition();
            }
        },
        getSizeForItemsCount: function (count) {
            if (isNaN(count) || count === 0) {
                return null;
            }
            var size = {}, itemRows = Math.floor(count / this.$.cols);

            size.height = itemRows * (this.$.itemHeight + this.$.verticalGap);

            // size.width = (this.$.cols * (this.$.itemWidth + this.$.horizontalGap)) || null;

            return size;
        },
        getIndexFromPoint: function (x, y, gapHPos, gapVPos) {
            var col, row;

            /* TODO: add gap position */
            /*
             position.x -= (gapHPos / 2) * horizontalGap;
             position.y -= (gapVPos / 2) * verticalGap;
             */

            x += (this.$.horizontalGap) *0.5;
            y += (this.$.verticalGap) * 0.5;

            col = this.$.cols === 1 ? 0 : Math.floor(x / (this.$.itemWidth + this.$.horizontalGap));
            row = this.$.rows === 1 ? 0 : Math.floor(y / (this.$.itemHeight + this.$.verticalGap));
            return row * this.$.cols + col;
        },

        getPointFromIndex: function (index) {

            var row = Math.floor(index / this.$.cols),
                col = index % this.$.cols;

            return {
                x: col * (this.$.itemWidth + this.$.horizontalGap),
                y: row * (this.$.itemHeight + this.$.verticalGap)
            };

        },

        /***
         *
         * @abstract
         * @param {Element} el
         * @returns {js.core.DomElement}
         * @private
         */
        _getScrollContainer: function () {

            var scrollContainer = this.get('$scrollContainer');

            if (!scrollContainer) {
                throw "implement _getScrollContainer or set cid='$scrollContainer'";
            }

            return scrollContainer;

        },
        _onKeyDown: function (e) {
            if (e.domEvent.keyCode === 38 || e.domEvent.keyCode === 40 || e.domEvent.keyCode === 37 || e.domEvent.keyCode === 39) {
                var index = this.$currentSelectionIndex ? this.$currentSelectionIndex : 0;
                switch (e.domEvent.keyCode) {
                    case 38: index -= this.$.cols; break;
                    case 40: index += this.$.cols; break;
                    case 37: index--; break;
                    case 39: index++; break;
                    default: void 0;
                }
                if (index < 0) {
                    index = 0;
                }
                this._selectItem(index, e.domEvent.shiftKey, false);
                e.preventDefault();
                e.stopPropagation();
            }
        },
        _selectItem: function (index, shiftDown, metaKey) {
            if(this.$.selectionMode === SELECTION_MODE_NONE){
                return;
            }
            if(this.$.selectionMode === SELECTION_MODE_SINGLE){
                shiftDown = false;
                metaKey = false;
            }
            if (!metaKey) {
                for (var key in this.$selectionMap) {
                    if (this.$selectionMap.hasOwnProperty(key)) {
                        this.$selectionMap[key].set({selected: false});
                        this.$.selectedItems.remove(this.$selectionMap[key].$.data);
                        delete this.$selectionMap[key];
                    }
                }
            }

            if (!shiftDown || metaKey) {
                this.$lastSelectionIndex = index;
            }
            var startIndex, endIndex;
            if (this.$lastSelectionIndex !== undefined && index < this.$lastSelectionIndex) {
                startIndex = index;
                endIndex = this.$lastSelectionIndex;
            } else {
                startIndex = this.$lastSelectionIndex;
                endIndex = index;
            }
            this.$currentSelectionIndex = index;
            var item, id;
            for (var i = startIndex; i <= endIndex; i++) {
                item = this.$.$dataAdapter.getItemAt(i);
                id = item.get('data.$cid');
                if (id) {
                    if (metaKey && item.$.selected) {
                        delete this.$selectionMap[id];
                        this.$.selectedItems.remove(item.$.data);
                        item.set('selected', false);
                    } else {
                        this.$selectionMap[id] = item;
                        this.$.selectedItems.add(item.$.data);
                        item.set('selected', true);

                    }
                } else {
                    console.warn("no id defined for data item");
                }
            }
            var pos = this.getPointFromIndex(index), y = pos.y, topDiff = y - this.$el.scrollTop, bottomDiff = topDiff + this.$.itemHeight + this.$.verticalGap - this.$.height;
            topDiff -= this.$.verticalGap;
            if(bottomDiff > 0){
                this.$el.scrollTop += bottomDiff;
            }
            if(topDiff < 0){
                this.$el.scrollTop += topDiff;
            }
            if (!shiftDown) {
                this.$lastSelectionIndex = index;
            }
        },
        isItemSelected: function (data) {
            if (!data) {
                return false;
            }
            var cid = data.$cid;
            return cid && this.$.selectedItems[cid] !== undefined;
        }
    }, {
        createDataAdapter: function (data, virtualItemsView) {

            if (data instanceof Collection) {
                return new (VirtualItemsView.VirtualCollectionDataAdapter)(data, virtualItemsView);
            } else if (data instanceof List || data instanceof Array) {
                return new (VirtualItemsView.VirtualDataAdapter)(data, virtualItemsView);
            }

            return null;
        }
    });

    /***
     *
     */
    VirtualItemsView.VirtualDataAdapter = Bindable.inherit('js.ui.VirtualItemsView.VirtualDataAdapter', {

        ctor: function (data, virtualItemsView) {

            if (data && !(data instanceof Array || data instanceof List)) {
                throw "data needs to be either an Array or a List"
            }

            this.$data = data;
            this.$virtualItemsView = virtualItemsView;

            this.callBase(null);

        },

        getItemAt: function (index) {
            var data = this.$data,
                dataItem = null;

            if (data instanceof Array) {
                dataItem = data[index];
            } else if (data instanceof List) {
                dataItem = data.$items[index];
            }

            if (dataItem) {
                dataItem = new (VirtualItemsView.DataItem)({
                    index: index,
                    data: dataItem
                });
            }

            return dataItem;
        },

        /***
         * @returns {Number} the size of the list
         */
        size: function () {
            return this.$data ? this.$data.length : 0;
        }.onChange('$data')
    });

    VirtualItemsView.VirtualCollectionDataAdapter = VirtualItemsView.VirtualDataAdapter.inherit('js.ui.VirtualItemsView.VirtualCollectionDataAdapter', {

        ctor: function (data) {

            if (data && !(data instanceof Collection)) {
                throw  "data needs to be a Collection";
            }

            // stores the waiting queue or true, if page already fetched
            this.$pages = {};
            this.$cache = {};
            this.$pageSize = data.$options.pageSize;

            this.callBase();

            this.$collectionSizeUnknown = isNaN(this.size);
        },

        getItemAt: function (index) {
            // get the page from index
            var self = this,
                pageIndex = Math.floor(index / this.$pageSize),
                firstTimeToFetchPage = false,
                dataItem = this.$cache[index];

            if (!this.$pages.hasOwnProperty(pageIndex)) {
                this.$pages[pageIndex] = {};
                firstTimeToFetchPage = true;
            }

            if(!dataItem){
                dataItem = new (VirtualItemsView.DataItem)({
                    index: index,
                    data: null,
                    $status: STATUS_LOADING
                });
                this.$cache[index] = dataItem;
            }

            var pageEntry = this.$pages[pageIndex];

            if (pageEntry === true) {
                dataItem.set('$status', STATUS_LOADED);
                // page already fetched -> return with data
                dataItem.set('data',this.$data.at(index));
            } else {
                dataItem.set('$status',STATUS_LOADING);
                // add callback after fetch completes, which sets the data
                pageEntry[index] = function () {
                    dataItem.set('data', self.$data.at(index));
                    dataItem.set('$status', STATUS_LOADED);
                };

                if (firstTimeToFetchPage) {

                    (function(pageIndex) {
                        // first time -> start fetch delay
                        setTimeout(function () {

                            // delay passed -> check if at least on item of the page is needed
                            var pageStartIndex = pageIndex * self.$pageSize,
                                pageEndIndex = (pageIndex + 1) * self.$pageSize - 1;

                            var virtualItemsView = self.$virtualItemsView;

                            if (virtualItemsView.$lastStartIndex <= pageEndIndex &&
                                virtualItemsView.$lastEndIndex >= pageStartIndex) {

                                // we need to fetch the page
                                self.$data.fetchPage(pageIndex, null, function (err) {
                                    if (err) {
                                        // delete page so it will be fetched again on scrolling
                                        delete self.$pages[pageIndex];
                                    } else {
                                        // execute all callbacks
                                        var pageEntry = self.$pages[pageIndex];
                                        for (var key in pageEntry) {
                                            if (pageEntry.hasOwnProperty(key)) {
                                                (pageEntry[key])();
                                                delete pageEntry[key];
                                            }
                                        }

                                        // mark as already fetched
                                        self.$pages[pageIndex] = true;

                                        if (self.$collectionSizeUnknown) {
                                            // after the successfully fetch the size of the collection should be
                                            // known -> update the VirtualItemsView
                                            self.$collectionSizeUnknown = false;
                                            self.$virtualItemsView._updateVisibleItems();
                                        }
                                    }
                                });
                            } else {
                                // we don't need to fetch this page any more
                                delete self.$pages[pageIndex];
                            }

                        }, self.$virtualItemsView.$.fetchPageDelay);
                    })(pageIndex)


                }
            }

            return dataItem;

        },


        /***
         * @returns {Number} the size of the list, or NaN if size currently unknown
         */
        size: function () {
            return this.$data ? this.$data.$.$itemsCount : NaN;
        }.on(['$data','change:$itemsCount'])
    });

    var STATUS_EMPTY = "empty", STATUS_LOADING = "loading", STATUS_LOADED = "loaded";

    /***
     *
     * @class
     */
    VirtualItemsView.DataItem = Bindable.inherit('js.ui.VirtualItemsView.DataItem', {
        defaults: {
            // holds the index of the datasource, and is set by VirtualItemsView
            $index: null,
            // loading status
            status: STATUS_EMPTY,
            selected: false,
            // the data, which is set by the VirtualDataAdapter
            data: null
        }
    });


    return VirtualItemsView;
});