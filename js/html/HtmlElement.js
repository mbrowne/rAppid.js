define(['js/core/DomElement', 'underscore'], function (DomElement, _) {

    var HTML_Namespace = "http://www.w3.org/1999/xhtml",
        POLICY_OUT = 'out',
        POLICY_IN = 'in',
        POLICY_BOTH = 'both',
        attributeMap = {
            height: 'offsetHeight',
            width: 'offsetWidth'
        };

    /**
     * Sets the size of an element, if the policy requires it
     * @param element
     * @param policy
     * @param attribute
     */
    var checkSizePolicy = function(element, policy, attribute){
        if (policy === POLICY_IN || policy === POLICY_BOTH) {
            element.set(attribute, element.$el[attributeMap[attribute]]);
        }
    };

    /**
     * Binds the window resize event and sets the size on resize if the policy requires it
     * @param element
     * @param policy
     * @param attribute
     */
    var bindSizePolicy = function (element, policy, attribute) {
        var elAttribute;
        if (policy === POLICY_IN || policy === POLICY_BOTH) {
            if (!element["__update"+attribute]) {
                var self = element;
                element["__update" + attribute] = function () {
                    self.set(attribute, self.$el[attributeMap[attribute]]);
                };
                element.dom(element.$stage.$window).bindDomEvent('resize', element["__update" + attribute]);
            }
        } else {
            if (element["__update" + attribute]) {
                element.dom(element.$stage.$window).unbindDomEvent('resize', element["__update" + attribute]);
                delete element["__update" + attribute];
            }
        }

    };

    var HtmlElement = DomElement.inherit("js.html.HtmlElement", {

        defaults: {
            selected: undefined,
            selectable: undefined,
            namespace: HTML_Namespace,

            position: null,

            heightUpdatePolicy: POLICY_OUT,
            widthUpdatePolicy: POLICY_OUT
        },

        $classAttributes: ['heightUpdatePolicy', 'widthUpdatePolicy'],

        $renderAsStyle: ['position'],

        $renderAsStyleWithPx: ['left', 'top'],
        /**
         *
         * @private
         */
        _onDomAdded: function(){
            this.callBase();

            checkSizePolicy(this,this.$.widthUpdatePolicy,'width');
            checkSizePolicy(this,this.$.heightUpdatePolicy,'height');
        },
        /**
         *
         * @param policy
         * @private
         */
        _renderHeightUpdatePolicy: function (policy) {
            bindSizePolicy(this, policy, "height");
        },
        /**
         *
         * @param policy
         * @private
         */
        _renderWidthUpdatePolicy: function (policy) {
            bindSizePolicy(this, policy, "width");
        },
        /**
         *
         * @param selected
         * @private
         */
        _renderSelected: function (selected) {
            if (selected) {
                this.addClass('active');
            } else {
                this.removeClass('active');
            }
        },
        /**
         *
         * @param key
         * @param value
         * @private
         */
        _setAttribute: function (key, value) {

            var renderAsStyle;
            if (_.indexOf(this.$renderAsStyleWithPx, key) !== -1) {
                if (!_.isString(value)) {
                    value += "px";
                }

                renderAsStyle = true;
            }

            if (renderAsStyle || _.indexOf(this.$renderAsStyle, key) !== -1) {
                this.$el.style[key] = value;
            } else {
                this.callBase();
            }
        },
        /**
         *
         * @param selectable
         * @private
         */
        _renderSelectable: function (selectable) {
            if (selectable === true) {
                if (!this._onSelect) {
                    var self = this;
                    this._onSelect = function () {
                        self.set({selected: !self.$.selected});
                    };
                }
                this.bindDomEvent('click', this._onSelect);
            } else {
                if (this._onSelect) {
                    this.unbindDomEvent('click', this._onSelect);
                }
            }
        },

        /***
         * renders the width of the element if the update-policy allows out-going
         * @param width - the width in pixel if not a string
         * @private
         */
        _renderWidth: function (width) {
            this._renderPolicyValue('width', width);
        },

        /***
         * renders the height of the element if the update-policy allows out-going
         * @param height - the width in pixel if not a string
         * @private
         */
        _renderHeight: function (height) {
            this._renderPolicyValue('height', height);
        },
        /***
         *
         * @param position
         * @private
         */
        _renderPosition: function (position) {
            if(position){
                this.$el.style.position = position;
            }
        },
        /***
         *
         * @param name
         * @param value
         * @private
         */
        _renderPolicyValue: function (name, value) {
            var policy = this.$[name + 'UpdatePolicy'];

            if (policy === POLICY_OUT || policy === POLICY_BOTH) {
                if(value != null){
                    if (typeof(value) !== "string") {
                        value = Math.min(17895697,value); // max height in firefox
                        value += "px";
                    }
                    this.$el.style[name] = value;
                }
            }

        }

    });

    HtmlElement.HTML_Namespace = HTML_Namespace;

    return HtmlElement;
});