/*
 * Copyright 2013 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global d3, Ext */

/**
 *
 * Written by: Gagarine Yaikhom (g.yaikhom@har.mrc.ac.uk)
 */
(function () {
    /* this is the global variable where we expose the public interfaces */
    if (typeof dcc === 'undefined')
        dcc = {};

    /* semantic version (set from pom.xml) */
    dcc.version = 'DCC_QC_VERSION';

    /* format for conversion between datetime */
    dcc.dateTimeFormat = d3.time.format('%Y-%m-%d %H:%M:%S');
    dcc.dateFormat = d3.time.format('%e %B %Y, %A');

    /* object that stores all of the visualisations */
    dcc.viz = undefined;

    /* object that handles image visualisation */
    dcc.imageViewer = null;

    /* this disables existing media details from the previous context */
    dcc.mediaContextForQC = null;

    /* the state Id comes from phenodcc_qc.data_context table */
    dcc.getStateIconName = function (record) {
        var stateId = record.get("stateId"), icon = stateToIconMap[stateId];
        /* if data added, modified, removed or issue status, mark as data modified */
        if (stateId === 2 || stateId === 3 || stateId === 4 || stateId === 5)
            icon = 'redoqc';
        if (record.get("numUnresolved") > 0)
            icon += '_hasissues';
        return icon;
    };
    dcc.getStateIcon = function (stateId, metaData, record, isParameter) {
        var icon = stateToIconMap[stateId];
        if (isParameter) {
            /* has_issues status when we cannot ascertain from the context
             * what happened (add, change, remove). Assume, data changed. */
            if (stateId === 5)
                icon = 'datachanged';
        } else {
            /* if data added, modified, removed, mark as data modified */
            if (stateId === 2 || stateId === 3 || stateId === 4 || stateId === 5)
                icon = 'redoqc';
        }
        if (record.get("ur") > 0)
            icon += '_hasissues';
        return '<img src="resources/images/' + icon + '.png"></img>';
    };

    /* allows users to hide genes/strains that have already been QC ticked */
    dcc.hideQcTicked = false;

    /* map data context state to icon. Note that the name and order
     * of these string literals must match the name and precedence
     * defined by the consistent identifiers (cid) in phenodcc_qc.a_state. */
    var stateToIconMap,
        /* some constants that allows configuration of the tool */
        FLOAT_DISPLAY_PRECISION = 5,
        GENE_KEY_FIELD = 'gid',
        PROCEDURE_KEY_FIELD = 'peid',
        PARAMETER_KEY_FIELD = 'qeid',
        /* We select genes and parameters that are use by the visualiation.
         * These selections are maintained as a doubly-linked list. */
        geneList, parameterList,
        /* All of the visualisations are displayed using a two dimensional
         * grid where the columns represent the selected genes, whereas, the rows
         * represent the selected parameters. This is referred to as the
         * visualiation cluster, and is managed under the following DOM node */
        visualisationCluster = null,
        /* All of the visualisations are interactive. The use has the facility to
         * enable or disable several features (e.g., show/hide statistics). All of
         * these settings are controlled using a bitmap. The following lists all of
         * the possible settings that are available through the controls panel. */
        controlOptions,
        DEFAULT_VISUALISATION_SETTING = 113121,
        /* when a user hovers over a data point, further information concerning
         * the data point is displayed using a popup box. The following implements
         * the popup box. We use one popup box that is shared by all of the
         * visualisations. */
        informationBox, /* object that points to the information box DOM node */
        informationBoxOffset = 15, /* pixel displacement from mouse pointer */
        informationBoxWidth,
        informationBoxHeight,
        /* the width of a visualisation determines the dimensions of the dimensions
         * of all the visualisations. This values changes according to the scale
         * (S - Small, M - Medium, L - Large, XL - Extra large) selected in the
         * controls panel. From this width, the height is calculated to match the
         * required aspect ratio. */
        visualisationWidth, /* in pixels */
        VISUALISATION_ASPECT_RATIO = 1.77,
        /* if animataing interfaces, how long should it last */
        ANIMATION_DURATION = 200,
        /* how long to delay before an interaction, say scrolling, takes effect */
        EVENT_THROTTLE_DELAY = 200,
        /* Using the controls panel, a user can filter out data points from the
         * visualisation based on their zygosity. The following list the possible
         * filters available */
        ZYGOSITY_ALL = 0, /* display all */
        ZYGOSITY_HET = 1, /* only heterozygous */
        ZYGOSITY_HOM = 2, /* only homozygous */
        ZYGOSITY_HEM = 3, /* only hemizygous */
        zygosity = ZYGOSITY_ALL, /* by default, do not filter by zygosity */
        /* When a visualisation becomes visible, an AJAX call retrieves the
         * required measurements. After measurements have been retrieved, all of
         * the statistical calculations are carried out. These calculated values
         * are then cached for future. The following contains the cached results,
         * which contains measurements and statistics for het, hom, hem and all
         * respectively. */
        measurementsSet = [{}, {}, {}, {}],
        /* for every visualisation, we provide the facility to display
         * measurements that belongs to a specific meta-data group. We store in
         * the following all of the unique meta-data group values. */
        metadataGroups = {},
        isSupportedTouchDevice = navigator.userAgent.match(/Android|iPhone|iPad/i),
        /* touch events */
        TOUCH_START = 'touchstart',
        /* swarm data points are not allowed to go further than
         * this bound relative to the principal swarm axis on both sides */
        SWARM_BOUND = 70,
        /* radius of data points in pixels */
        WILDTYPE_DATAPOINT_RADIUS = 2,
        MUTANT_DATAPOINT_RADIUS = 2.5,
        STAT_DATAPOINT_RADIUS = 3,
        HIGHLIGHTED_DATAPOINT_RADIUS = MUTANT_DATAPOINT_RADIUS + 2,
        highlightedSpecimen = -1, /* current highligghted specimen */
        /* colours used to display pie charts */
        pieColours,
        /* reference to body */
        body = d3.select('body'),
        /* we use the options aray for assigning colour to category legends.
         * The following variable stores the latest colour index. The colour
         * index is derived from parameter options (see processParameters). */
        categoryColourIndex,
        numCategories = 1,
        /* contains datapoints that are actively selected by the user, or
         * contains cited data points that are associated with an issue. */
        selectedDatapoints = null,
        numberInitiallyCited = 0,
        numberOfSelectedAnimals = 0,
        citedDatapointsNotification = null,
        measurementLookUpTable = {}, /* to fill in cited data points x, y */

        /* ajax requests (used for aborting existing request) */
        citedDataPointRequest = {},
        retrieveMeasurementsRequest = {},
        retrieveViabilityRequest = {},
        retrieveFertilityRequest = {},
        retrieveSpecimenDetailsRequest = {},
        retrieveSelectedSpecimenDetailsRequest = {},
        informationBoxIsDisabled = false
        ;

    stateToIconMap = [
        'nodata', 'qcdone', 'dataadded',
        'datachanged', 'dataremoved', 'hasissues'
    ];

    controlOptions = {
        'none': 0x0, /* 32 -bits, 32 options possible */
        'all': 0xffffffff, /* 32 -bits, 32 options possible */
        'mean': 0x1, /* show arithmetic mean */
        'median': 0x2, /* show median */
        'max': 0x4, /* show maximum values */
        'min': 0x8, /* show minimum values */
        'quartile': 0x10, /* show first and third quartiles */
        'female': 0x20, /* include female specimens */
        'male': 0x40, /* include male specimens */
        'point': 0x80, /* show data points */
        'polyline': 0x100, /* show polylines */
        'errorbar': 0x200, /* show error bar (by default standard deviation) */
        'crosshair': 0x400, /* show crosshair */
        'wildtype': 0x800, /* include wild type specimens */
        'whisker': 0x1000, /* show box and whisker */
        'whisker_iqr': 0x2000, /* extend whiskers to 1.5 IQR */
        'infobar': 0x4000, /* show information about the visualisation */
        'statistics': 0x8000, /* show descriptive statistics */
        'swarm': 0x10000, /* show beeswarm plot */
        'hom': 0x20000, /* include homozygotes */
        'het': 0x40000, /* include heterozygotes */
        'hem': 0x80000, /* include hemizygotes */
        'std_err': 0x100000, /* show standard error for error bars */
        'highlight': 0x200000, /* highlight selected specimen */
        'selected': 0x400000, /* show selected points only */
        'minmax': 0x800000, /* show QC min/max range */
        'shapes': 0x2000000, /* use shapes to display data points */
        /* deprecated */
        'newdata': 0x0000000 /* 0x1000000: highlight data added since last action */
    };

    pieColours = [
        '#99cc00', '#1a9df2', '#ff8800', '#aa66cc'
    ];

    /**
     * We maintain selected datapoints using the following object.
     * 
     * @param {String} selector DOM selector.
     */
    function SelectedDatapoints(selector) {
        this.count = 0;
        this.items = {};
        this.selector = selector;
    }

    SelectedDatapoints.prototype = {
        notify: function () {
            var me = this;
            d3.select(me.selector).text(me.count);
        },
        reset: function () {
            var me = this;
            me.count = 0;
            me.items = {};
            me.notify();
        },
        add: function (key, datapoint) {
            var me = this;
            if (me.items[key] === undefined) {
                me.items[key] = datapoint;
                me.count++;
            }
            me.notify();
        },
        remove: function (key) {
            var me = this;
            if (me.items[key] !== undefined) {
                delete me.items[key];
                me.count--;
            }
            me.notify();
        },
        isEmpty: function () {
            var me = this;
            return me.count === 0;
        },
        getCount: function () {
            var me = this;
            return me.count;
        },
        contains: function (key) {
            var me = this;
            return me.items[key] !== undefined;
        },
        each: function (f) {
            var me = this, i;
            if (f)
                for (i in me.items)
                    f(me.items[i]);
        },
        get: function (key) {
            var me = this;
            return me.items[key];
        }
    };

    /**
     * Selects a specimen, and highlights them if highlighting is active.
     *
     * @param {type} animalId Unique identifier of the specimen to highlight.
     */
    dcc.selectSpecimen = function (animalId) {
        var viz = dcc.viz;
        if (viz) {
            highlightSpecimen(animalId);
        } else if (dcc.imageViewer) {
            dcc.imageViewer.selectSpecimen(animalId);
        }
    };

    /**
     * Set selected datapoints by including all of the cited data points. This
     * is called by QualityControl.js when an issue on ExtJS grid is selected.
     *
     * @param {type} issueDatapoints Contains cited datapoints for an issue.
     */
    function setCitedDatapoints(issueDatapoints) {
        var i, datapoints = issueDatapoints.citeddatapoints,
            c = datapoints.length, t, countMissingDatapoints = 0, msg = '',
            messagesPanel = dcc.extjs.controller.getIssueMessagesPanel();
        selectedDatapoints.reset();
        numberInitiallyCited = issueDatapoints.count;

        for (i = 0; i < c; ++i) {
            t = datapoints[i];
            if (measurementLookUpTable[t.m] === undefined)
                countMissingDatapoints++;
            else
                selectedDatapoints.add(t.m, {
                    a: t.a,
                    m: t.m
                });
        }

        if (numberInitiallyCited > 0) {
            if (countMissingDatapoints > 0)
                msg = "<div id='issue-warnings'>" + countMissingDatapoints +
                    " out of " + numberInitiallyCited +
                    " initially cited data-points have since been removed or replaced.</div>";
            else
                msg = "<div id='issue-info'>Found " + numberInitiallyCited +
                    " initially cited data-points.</div>";
        } else
            msg = "<div id='issue-info'>Issue does not cite any data-point.</div>";
        messagesPanel.update(msg);
    }

    /**
     * Display notification when loading cited data points.
     */
    function showCitedDatapointsNotification() {
        if (citedDatapointsNotification)
            citedDatapointsNotification.style('opacity', 1);
    }

    /**
     * Hide notification once cited data points have been loaded.
     */
    function hideCitedDatapointsNotification() {
        if (citedDatapointsNotification)
            citedDatapointsNotification.style('opacity', 0);
    }

    /**
     * Implements a doubly-linked list. This is used for maintaining the current
     * gene and parameter selections. We use doubly-linked list because it
     * makes ordering of list items by dragging must easier to implement.
     *
     * @param {String} keyName Item property name to use a node key.
     */
    var DoubleLinkedList = function (keyName) {
        this.head = null;
        this.tail = null;
        this.numNodes = 0;
        this.keyName = keyName;
    };

    DoubleLinkedList.prototype = {
        count: function () {
            return this.numNodes;
        },
        makeNode: function (data) {
            var me = this, node = {};
            node.data = data;
            node.key = data[me.keyName];
            node.next = null;
            node.prev = null;
            return node;
        },
        first: function (node) {
            var me = this;
            me.head = node;
            me.tail = node;
        },
        append: function (node) {
            var me = this;
            node = me.makeNode(node);
            ++me.numNodes;
            if (me.tail === null)
                me.first(node);
            else {
                node.next = null;
                node.prev = me.tail;
                me.tail.next = node;
                me.tail = node;
            }
        },
        add: function (node) {
            var me = this;
            node = me.makeNode(node);
            ++me.numNodes;
            if (me.head === null)
                me.first(node);
            else {
                node.prev = null;
                node.next = me.head;
                me.head.prev = node;
                me.head = node;
            }
        },
        insertAfter: function (node, index) {
            var me = this, cursor = me.nodeAt(index);
            node = me.makeNode(node);
            ++me.numNodes;
            if (cursor === null)
                me.append(node);
            else {
                node.prev = cursor;
                node.next = cursor.next;
                cursor.next.prev = node;
                cursor.next = node;
            }
        },
        del: function (node) {
            var me = this;
            --me.numNodes;
            if (node.prev === null)
                me.head = node.next;
            else
                node.prev.next = node.next;

            if (node.next === null)
                me.tail = node.prev;
            else
                node.next.prev = node.prev;
            delete node;
        },
        empty: function () {
            var me = this, temp = me.head, next;
            while (temp) {
                next = temp.next;
                delete temp;
                temp = next;
            }
            me.numNodes = 0;
            me.head = me.tail = null;
        },
        nodeAt: function (index) {
            var me = this, cursor = me.head, count = 0;
            while (cursor !== null && count++ < index)
                cursor = cursor.next;
            return cursor;
        },
        find: function (key) {
            var me = this, cursor = me.head;
            while (cursor !== null) {
                if (cursor.key === key)
                    break;
                cursor = cursor.next;
            }
            return cursor;
        },
        remove: function (key) {
            var me = this, node = me.find(key);
            if (node !== null)
                me.del(node);
            return me.count();
        },
        moveTo: function (key, index) {
            var me = this, node = me.find(key), successor = me.nodeAt(index);
            if (node !== null) {
                if (successor !== node) {
                    /* detach node to be moved */
                    if (node.prev === null) {
                        me.head = node.next;
                        if (me.head !== null)
                            me.head.prev = null;
                    } else {
                        node.prev.next = node.next;
                    }
                    if (node.next === null) {
                        me.tail = node.prev;
                        if (me.tail !== null)
                            me.tail.next = null;
                    } else {
                        node.next.prev = node.prev;
                    }

                    /* make the insertion at new location */
                    if (successor === null) {
                        node.next = null;
                        node.prev = me.tail;
                        if (me.tail === null)
                            me.head = node;
                        else
                            me.tail.next = node;
                        me.tail = node;
                    } else {
                        node.prev = successor.prev;
                        node.next = successor;
                        if (successor.prev === null)
                            me.head = node;
                        else
                            successor.prev.next = node;
                        successor.prev = node;
                    }
                }
            }
        },
        print: function () {
            var me = this, cursor = me.head;
            while (cursor !== null) {
                console.log(cursor);
                cursor = cursor.next;
            }
        },
        traverse: function (doSomething) {
            var me = this, cursor = me.head;
            while (cursor !== null) {
                doSomething(cursor.data, cursor.key);
                cursor = cursor.next;
            }
        }
    };

    dcc.visualisationControl = DEFAULT_VISUALISATION_SETTING;
    geneList = new DoubleLinkedList(GENE_KEY_FIELD);
    parameterList = new DoubleLinkedList(PARAMETER_KEY_FIELD);
    selectedDatapoints = new SelectedDatapoints('#num-selected-datapoints');


    /**
     * Removes all white spaces from beginning and end. This extends the
     * String prototype.
     *
     * @description
     * Steven Levithan has made a comparison of various implementations.
     *
     * http://blog.stevenlevithan.com/archives/faster-trim-javascript
     */
    String.prototype.trim = function () {
        return this.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    };

    /**
     * Makes the first character of the string uppercase.
     */
    String.prototype.icap = function () {
        return this.substr(0, 1).toUpperCase() + this.substr(1);
    };

    /**
     * Returns a substring of the string object after discarding characters
     * from either the start, or the end.
     *
     * <p>If the supplied number of characters to be discarded is
     * less than 0, they are discarded at the end; otherwise, they are
     * discarded from the start of the string. <i>The original string is
     * left unmodified.</i></p>
     *
     * @param {Integer} nchars Number of characters to discard.
     *
     * @return {String} A substring with the remaining characters.
     */
    String.prototype.discard = function (nchars) {
        var length = this.length - nchars;
        return nchars < 0 ? this.substr(0, length)
            : this.substr(nchars, length);
    };

    /**
     * Returns a comparator. This method can generate comparators for
     * either one or two fields.
     *
     * @param {String} p First field to compare with.
     * @param {String} q Second field to compare after first comparison.
     * @returns {Function} Comparator function.
     */
    function getComparator(p, q) {
        return function (a, b) {
            if (a[p] === b[p]) {
                if (q === undefined)
                    return 0;
                else {
                    if (a[q] === b[q])
                        return 0;
                    if (a[q] < b[q])
                        return -1;
                    return 1;
                }
            }
            if (a[p] < b[p])
                return -1;
            return 1;
        };
    }

    /**
     * Converts floating-point value to required precision. If value is
     * supplied as a string, we first convert the value to a float.
     *
     * @param {Float|String} value Float value.
     * @returns {Float} Float value with the required precision.
     */
    function toDisplayPrecision(value) {
        if (typeof value === 'string')
            value = parseFloat(value);
        return value.toFixed(FLOAT_DISPLAY_PRECISION);
    }

    /**
     * Adds milliseconds to a date.
     *
     * @param {Date} date Date object.
     * @param {Integer} milliseconds Number of milliseconds to add.
     * @returns {Date} New date.
     */
    function addMillisecondstoDate(date, milliseconds) {
        return new Date(date.getTime() + milliseconds);
    }

    /**
     * Adds days to a date.
     *
     * @param {Date} date Date object.
     * @param {Integer} days Number of days to add.
     * @returns {Date} New date.
     */
    function addDaysToDate(date, days) {
        return addMillisecondstoDate(date, days * 86400000);
    }

    /**
     * Prevent event from bubbling to parent DOM nodes.
     */
    function preventEventBubbling() {
        var event = d3.event;
        if (event.preventDefault)
            event.preventDefault();
        if (event.stopPropagation)
            event.stopPropagation();
        event.cancelBubble = true;
        return false;
    }

    /**
     * Delays execution of an event handler.
     *
     * @param {Function} method Event handler.
     * @param {Integer} delay Delay in milliseconds before invoking handler.
     * @param {Object} thisArg The object to use as this inside the handler.
     */
    dcc.throttle = function (method, delay, thisArg) {
        clearTimeout(method.throttleTimeout);
        method.throttleTimeout =
            setTimeout(function () {
                method.apply(thisArg);
            }, delay);
    };

    /**
     * Returns visulisation beight to satisfy required aspect ratio.
     *
     * @param {Integer} width The width of the visualisation.
     * @returns {Integer} Visualisation height.
     */
    function getAspectHeight(width) {
        return width / VISUALISATION_ASPECT_RATIO;
    }

    /**
     * Returns a d3js linear scale for numerical data.
     *
     * @param {Real} domainLow Lowest value for the domain.
     * @param {Real} domainHigh highest value for the domain.
     * @param {Real} rangeLow Highest value for range.
     * @param {Real} rangeHigh Highest value for range.
     *
     * @return {Function} A scaling function that maps values from
     *         domain to range.
     */
    function getLinearScaler(domainLow, domainHigh, rangeLow, rangeHigh) {
        return d3.scale.linear()
            .domain([domainLow, domainHigh])
            .range([rangeLow, rangeHigh]);
    }

    /**
     * Returns a d3js time scale for data/time.
     *
     * @param {Real} domainLow Lowest value for the domain.
     * @param {Real} domainHigh highest value for the domain.
     * @param {Real} rangeLow Highest value for range.
     * @param {Real} rangeHigh Highest value for range.
     *
     * @return {Function} A scaling function that maps values from
     *         domain to range.
     */
    function getTemporalScaler(domainLow, domainHigh, rangeLow, rangeHigh) {
        return d3.time.scale()
            .domain([domainLow, domainHigh])
            .range([rangeLow, rangeHigh]);
    }

    /**
     * Appens a 'div' node with DOM identifier 'id' and class 'cls' as
     * a child under parent DOM node 'parent;.
     *
     * @param {Object} parent Parent DOM node.
     * @param {String} id Identifier to use for child.
     * @param {String} cls Class to apply to child.
     * @param {String} text Text to put inside div.
     * @returns {Object} Child DOM node.
     */
    function addDiv(parent, id, cls, text) {
        var node = parent.append('div');
        if (id)
            node.attr('id', id);
        if (cls)
            node.attr('class', cls);
        if (text)
            node.text(text);
        return node;
    }

    /**
     * Clears DOM node by recursively removing all of the children node.
     *
     * @param {Object} node Parent DOM node.
     */
    function clear(node) {
        node.selectAll('*').remove();
    }

    /**
     * Returns the current height of the DOM node.
     * 
     * @param {Object} node DOM node.
     * @param {Integer} value New height.
     * @returns {Integer} Height of the DOM node.
     */
    function height(node, value) {
        if (typeof node === 'string')
            node = d3.select(node);
        if (value !== undefined)
            node.style('height', value + 'px');
        return node.node().getBoundingClientRect().height;
    }

    /**
     * Returns the current width of the DOM node.
     * 
     * @param {Object} node DOM node.
     * @param {Integer} value New height.
     * @returns {Integer} width of the DOM node.
     */
    function width(node, value) {
        if (typeof node === 'string')
            node = d3.select(node);
        if (value !== undefined) {
            node.style('width', value + 'px');
        }
        return node.node().getBoundingClientRect().width;
    }

    /**
     * Returns the specified dimension for the supplied DOM element node.
     *
     * <p>We use the rendered dimension information available in
     * the DOM's style property. Only dimensions that can be measured using
     * pixel units are permitted as dimension type.</p>
     *
     * @param {Object} dom A DOM element node that has been selected with D3.
     * @param {String} type The type of the dimension required.
     *
     * @return {Integer|null} The height of the DOM node, or null if invalid
     *         dimension type.
     */
    function getNodeDimension(dom, type) {
        var value = null;
        switch (type) {
            case 'height':
            case 'width':
                /* remove 'px' suffix before integer parse */
                value = parseInt(dom.style(type).discard(-2), 10);
                break;
            default:
        }
        return value;
    }

    /**
     * Appends a table row.
     *
     * @param {Object} table Parent table DOM node.
     * @param {String} cls Class to use for the table row.
     * @returns {Object} Row node.
     */
    function addRow(table, cls) {
        return table.append('tr').attr('class', cls);
    }

    /**
     * Appends column nodes to a row node.
     *
     * @param {Object} row Table row DOM node.
     * @param {String} text Column contents.
     * @param {String} link If the column should have a hyper-refrence anchor.
     */
    function addColumn(row, text, link) {
        var td = row.append('td');
        if (link) {
            td.append('a').attr('href', link).text(text);
        } else {
            if (text)
                td.text(text);
        }
        return td;
    }

    /* Display credits information */
    dcc.credits = function () {
        alert("P H E N O D C C   Q C   T O O L\n" +
            "(Version " + dcc.version + ")\n\n" +
            "The International Mouse Phenotyping Consortium\n" +
            "(http://www.mousephenotype.org/)\n\n" +
            "Web app designed and implemented by Gagarine Yaikhom\n" +
            "Medical Research Council Harwell\n\n" +
            "Uses backend systems developed by the PhenoDCC team."
            );
    };

    /**
     * Prepares the data-of-birth for display.
     *
     * @param {String} dob Date of birth value from server.
     * @returns {String} Valid date-of-birth information.
     */
    function prepareDateOfBirth(dob) {
        if (dob === null || dob.length === 0) {
            dob = "Unknown value";
        } else {
            try {
                dob = dcc.dateFormat(new Date(dob));
            } catch (e) {
                dob = "Invalid value";
            }
        }
        return dob;
    }

    /**
     * Prepares the sex of the specimen for display.
     *
     * @param {String} sex Sex of the specimen from server.
     * @returns {String} Valid sex information.
     */
    function prepareSex(sex) {
        if (sex === null || sex.length === 0) {
            sex = "Invalid";
        } else {
            if (sex.length === 1) {
                try {
                    switch (parseInt(sex)) {
                        case 0:
                            sex = "Female";
                            break;
                        case 1:
                            sex = "Male";
                            break;
                        default:
                            sex = "Invalid";
                    }
                } catch (e) {
                    sex = "Invalid";
                }
            } else {
                sex = "Invalid";
            }
        }
        return sex;
    }

    /**
     * Returns true if male; otherwise, false.
     *
     * @param {Object} datapoint Data point object.
     * @returns {Boolean} True if male; otherwise, female.
     */
    function isMaleDatapoint(datapoint) {
        return datapoint.s === 1;
    }

    /**
     * Prepares the zygosity of the specimen for display.
     *
     * @param {Integer} zygosity Zygosity of the specimen from server.
     * @returns {String} Valid zygosity information.
     */
    function prepareZygosity(zygosity) {
        if (zygosity === undefined) {
            zygosity = "Invalid";
        } else {
            switch (zygosity) {
                case 0:
                    zygosity = "Heterozygous";
                    break;
                case 1:
                    zygosity = "Homozygous";
                    break;
                case 2:
                    zygosity = "Hemizygous";
                    break;
                default:
                    zygosity = "Invalid";
            }
        }
        return zygosity;
    }

    /**
     * Prepares specimen litter information for display.
     *
     * @param {String} litter Litter information from server.
     * @returns {String} Valid litter information.
     */
    function prepareLitter(litter) {
        if (litter === null || litter.length === 0) {
            litter = "Unknown value";
        }
        return litter;
    }

    /**
     * Prepares specimen name for display.
     *
     * @param {String} name Specimen name from server.
     * @returns {String} Valid specimen name.
     */
    function prepareSpecimenName(name) {
        if (name === null || name.length === 0) {
            name = "Unknown value";
        }
        return name;
    }

    /**
     * Prepares the data point 'on hover' information.
     *
     * @param {Object} data Specimen data.
     * @param {Object} datapoint Contsins measurement id and animal id,
     *     which is retrieved from the visualisation.
     * @param {Object} ptype Plot type.
     */
    function prepareInfo(data, datapoint, ptype) {
        if (data === null)
            return "<h3>Server did not return valid data</h3>";

        var dob = prepareDateOfBirth(data.dob),
            animalName = prepareSpecimenName(data.animalName),
            litter = prepareLitter(data.litter), x,
            info = '<hr><ul><li><b>Name:</b> ' + animalName + '</li>' +
            '<li><b>DOB:</b> ' + dob + '</li>' +
            '<li><b>Litter:</b> ' + litter + '</li>' + '</ul>';

        if (ptype.t === 'nominal') {
            info = '<b>Category:</b> ' + datapoint.v + '</br>' + info;
        } else {
            x = datapoint.x;
            if (ptype.xt === 'd') {
                if (typeof x !== 'Date')
                    x = new Date(x);
                x = dcc.dateFormat(x);
            }
            info = '<b>X:</b> ' + x + '<br><b>Y:</b> ' + datapoint.y + info;
        }

        return info;
    }

    /**
     * Hides the information box pop-up.
     */
    function hideInformationBox() {
        informationBox.style('display', 'none');
    }

    /**
     * All of the visualisations share the same information box. This box is
     * initialised to be hidden when the web app starts.
     */
    function createInformationBox() {
        if (informationBox === undefined) {
            informationBox = addDiv(body, 'datapoint-infobox');
            informationBox.style('display', 'none')
                .on('mouseover',
                    function () {
                        preventEventBubbling();
                        hideInformationBox();
                    });
            informationBoxWidth =
                getNodeDimension(informationBox, 'width') + informationBoxOffset;
            informationBoxHeight =
                getNodeDimension(informationBox, 'height') + informationBoxOffset;
        }
    }

    /**
     * Relocates the information box which contains the data point details
     * relative to the current mouse pointer position.
     *
     * @param {Object} bmc Bounded mouse coordinates and bounding region.
     */
    function relocateInformationBox(bmc) {
        if (informationBoxIsDisabled) {
            informationBox.style('display', 'none');
            return;
        } else {
            informationBox.style('display', 'block');
        }

        var x = bmc.boundedCoordX, y = bmc.boundedCoordY,
            hx = bmc.rangeHighX, ly = bmc.rangeLowY;

        /* the label is positioned relative to the crosshair center.
         * the pointer crosshair divides the visualisation into four
         * quadrants. if possible, we should always show the label
         * inside the 4th quadrant (since it is easier to read the
         * label as we move the crosshair). However, if the label
         * cannot be displayed in full, we must choose an
         * alternative quadrant to display the information */
        x = x + informationBoxWidth > hx ?
            x - informationBoxWidth - informationBoxOffset :
            x + informationBoxOffset;
        y = y + informationBoxHeight > ly ?
            y - informationBoxHeight - informationBoxOffset :
            y + informationBoxOffset;

        /* move the information box to new position */
        informationBox
            .style('left', (x + bmc.originX) + 'px')
            .style('top', (y + bmc.originY) + 'px');
    }

    /**
     * Returns a sorted array by merging the contents of the supplied
     * sorted arrays. <i>The supplied arrays are left unmodified.</i>
     *
     * @param {Object[]} f First sorted array.
     * @param {Object[]} s Second sorted array.
     * @param {Function} comparator A comparator function that takes two values
     *        <b>a</b> and <b>b</b> and returns <b>0</b> if <b>a = b</b>,
     *        <b>1</b> if <b>a > b</b>, or <b>-1</b> otherwise.
     *
     * @return {Object[]} The merged sorted array.
     */
    function mergeSortedArrays(f, s, comparator) {
        var sortedArray = [], i, j; /* the merged array and temp variables */
        i = j = 0;
        while (i < f.length && j < s.length)
            sortedArray.push(comparator(f[i], s[j]) === -1 ? f[i++] : s[j++]);
        while (i < f.length)
            s.push(f[i++]);
        while (j < s.length)
            s.push(s[j++]);
        return sortedArray;
    }

    /**
     * Calculates the quartile value for the given data set. We first calculate
     * the quartile interval for the integral values, and then do a linear
     * interpolation with the fractional part.
     *
     * @param {Integer} whichQuartile first, second or third.
     * @param {[Number | Object]} dataset Dataset of one-dimensional numerical
     *         values, or two-dimensional objects. In the later case, the column
     *         must be specified.
     * @param {String} column For two-dimensional data set, which column
     *         represents the measured dataset.
     *
     * @returns The quartile value.
     */
    function calculateQuartile(whichQuartile, dataset, column) {
        var k = (whichQuartile * 0.25 * (dataset.length - 1)) + 1,
            truncated = Math.floor(k),
            fractional = k - truncated,
            /* indexing begins at 0 */
            low = dataset[truncated - 1],
            high = dataset[truncated];

        /* if two-dimensional, retrieve column value */
        if (column) {
            low = low[column];
            high = high[column];
        }
        return low + (fractional * (high - low)); /* lerp */
    }

    /**
     * Returns the 1st and 3rd quartile indices inside a sorted data set
     * with the supplied number of items.
     *
     * <p>Since the <i>median</i> is the second quartile, and has already been
     * calculated elsewhere, we do not calculate it here.</p>
     *
     * @param {[Number]} data Sorted data set.
     * @param {String} column For two-dimensional data set, which column
     *         represents the measured dataset.
     *
     * @return {Object} An object that contains two properties, <b>q1</b> and
     *      <b>q3</b>, which are indeed indices inside the sorted data set.
     *      These indices, respectively, point to the first and third quartiles.
     */
    function getFirstAndThirdQuartiles(data, column) {
        return {
            'q1': calculateQuartile(1, data, column),
            'q3': calculateQuartile(3, data, column)
        };
    }

    /**
     * Retrieves the 1st quartile
     *
     * @param {Object} d Datapoint.
     */
    function getQ1(d) {
        return {
            m: d.m,
            a: d.a,
            x: d.k,
            y: d.s.quartile === null ? null : d.s.quartile.q1
        };
    }

    /**
     * Retrieves the 3rd quartile
     *
     * @param {Object} d Datapoint.
     */
    function getQ3(d) {
        return {
            m: d.m,
            a: d.a,
            x: d.k,
            y: d.s.quartile === null ? null : d.s.quartile.q3
        };
    }

    /**
     * Calculates descriptive statistics for the supplied one-dimensional
     * data set (array of numerical values).
     *
     * <p>This implementation combines several algorithms and reuses common
     * values that have already been calculated by previous steps, thus
     * avoiding redundant loops.</p>
     *
     * @param {Object[]} dataset A one-dimensional array with data points.
     * @param {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b> and returns <b>0</b> if
     *        <b>a = b</b>, <b>1</b> if <b>a > b</b>, or <b>-1</b>
     *        otherwise. If <b>comparator = null</b>, the supplied array will
     *        be considered to be already sorted.
     *
     * @return {Object} An object that contains the statistical information.
     */
    function calculateArrayStatistics(dataset, comparator) {
        var statistics = null, size; /* statistics and number of data points */
        if (dataset && dataset instanceof Array) {
            size = dataset.length;
            var sum, max, min, mean, median,
                standardDeviation, standardError, quartile,
                distanceFromMean, isOdd,
                i, t; /* temp variables */

            if (comparator !== null)
                dataset.sort(comparator);
            max = min = sum = t = dataset[0];
            for (i = 1; i < size; ++i) {
                t = dataset[i];
                if (t > max)
                    max = t;
                if (t < min)
                    min = t;
                sum += t;
            }
            /* we now have maximum, minimum and sum of values */

            mean = sum / size;

            for (i = distanceFromMean = t = 0; i < size; ++i) {
                distanceFromMean = dataset[i] - mean;
                t += Math.pow(distanceFromMean, 2);
            }

            standardDeviation = Math.sqrt(t / (size - 1));
            standardError = standardDeviation / Math.sqrt(size);

            /* calculate median */
            i = Math.floor(size * 0.5); /* find middle, or left of middle */
            isOdd = size & 1; /* is the number of data points odd? */

            /* we must make index adjustments since array indexing begins at 0.
             * when the number of data points is odd, median has already been
             * index adjusted due to flooring */
            median = isOdd ? dataset[i] : (dataset[i] + dataset[i - 1]) * 0.5;

            /* calculate quartiles: requires a minimum of 2 data-points */
            quartile = size > 1 ? getFirstAndThirdQuartiles(dataset) : null;

            statistics = {
                'sum': sum,
                'max': max,
                'min': min,
                'mean': mean,
                'median': median,
                'sd': standardDeviation,
                'se': standardError,
                'quartile': quartile
            };
        }
        return statistics;
    }

    /**
     * Calculates descriptive statistics for a specific column in the supplied
     * two-dimensional data set. In contrast to the function
     * <b>calculateRowStatistics()</b>, it is imperative that <i>all rows
     * must have the same size</i>.
     *
     * <p>This implementation combines several algorithms and reuses common
     * values that have already been calculated by previous steps, thus
     * avoiding redundant loops.</p>
     *
     * @param {Object[]} dataset A one-dimensional array with data points.
     * @param {String | Integer} column The column to process. This can either
     *        be a column index (starting at 0), or an attribute name.
     * @param {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b>, and the column index, or
     *        attribute, <b>c</b> and returns <b>0</b> if <b>a[c] = b[c]</b>,
     *        <b>1</b> if <b>a[c] > b[c]</b>, or <b>-1</b> otherwise.
     *        If <b>comparator = null</b>, the supplied array is already sorted.
     *
     * @return {Object} An object that contains the statistical information.
     */
    function calculateColumnStatistics(dataset, column, comparator) {
        var statistics = null, size; /* statistics and number of data points */

        if (dataset === null
            || !(dataset instanceof Array)
            || (size = dataset.length) < 1) {
            statistics = null;
        } else {

            /* sum of values, maximum, minimum, mean, median,
             * population standard deviation, and quartile object */
            var sum, max, min, mean, median,
                standardDeviation, standardError, quartile,
                distanceFromMean, isOdd,
                t, i; /* temp variable and counter */

            sum = max = min = mean = median = 0;

            if (size > 0) {
                dataset.sort(comparator);

                max = min = sum = t = dataset[0][column];
                for (i = 1; i < size; ++i) {
                    t = dataset[i][column];
                    if (t > max)
                        max = t;
                    if (t < min)
                        min = t;
                    sum += t;
                }
                /* we now have maximum, minimum and sum of values */

                mean = sum / size;

                for (i = distanceFromMean = t = 0; i < size; ++i) {
                    distanceFromMean = dataset[i][column] - mean;
                    t += Math.pow(distanceFromMean, 2);
                }

                standardDeviation = Math.sqrt(t / (size - 1));
                standardError = standardDeviation / Math.sqrt(size);

                /* calculate median */
                i = Math.floor(size * 0.5); /* find middle, or left of middle */
                isOdd = size & 1; /* is the number of data points odd? */

                /* we must make index adjustments since array indexing begins
                 * at 0. when the number of data points is odd, median has
                 * already been index adjusted due to flooring */
                median = isOdd ? dataset[i][column]
                    : (dataset[i][column] + dataset[i - 1][column]) * 0.5;

                /* calculate quartiles: requires a minimum of 2 data-points */
                quartile = size > 1 ?
                    getFirstAndThirdQuartiles(dataset, column) : null;

                statistics = {
                    'sum': sum,
                    'max': max,
                    'min': min,
                    'mean': mean,
                    'median': median,
                    'sd': standardDeviation,
                    'se': standardError,
                    'quartile': quartile
                };
            }
        }
        return statistics;
    }

    /**
     * Returns a comparator function which takes a column property/index.
     *
     * @param {String | Integer} k Property to use as primary sorting key.
     * @param {String | Integer} j Property to use as secondary sorting key.
     *
     * @returns {Function | null} comparator A comparator function that takes
     *        two values <b>a</b> and <b>b</b>, and the column index, or
     *        attribute, <b>c</b> and returns <b>0</b> if <b>a[c] = b[c]</b>,
     *        <b>1</b> if <b>a[c] > b[c]</b>, or <b>-1</b> otherwise.
     *        If <b>comparator = null</b>, the supplied array is already sorted.
     */
    function getAttributeValueComparator(k, j) {
        return function (a, b) {
            return a[k] === b[k] ?
                (j === undefined ? 0 : (a[j] === b[j] ? 0 : a[j] > b[j] ? 1 : -1)) :
                a[k] > b[k] ? 1 : -1;
        };
    }

    /**
     * Groups measured items into series points using a key, and calculates
     * the group statistics for each of the series.
     *
     * @param {Object[]} dataset The data set, which is a one-dimensional array
     *      of objects with numerical data.
     * @param {String | Integer} keyColumn The column property/index inside a
     *      data-point to use as key for grouping.
     * @param {String | Integer} xColumn The column property/index that gives
     *      the x-value.
     * @param {String | Integer} yColumn The column property/index that gives
     *      the y-value.
     * @param {String | Integer} metadataGroupColumn The column property/index
     *      that gives the unique metadata group.
     * @param {String | Integer} animalIdColumn The column property/index
     *      that gives the unique animal identifier.
     * @param {String | Integer} measurementIdColumn The column property/index
     *      that gives the unique measurement identifier.
     * @param {String} target Statistics property to target.
     *
     * @return Object that contains statistical information. The structure of
     *     this object is as follows:
     *
     *     [
     *         { k, c, d, s: {max, min, sum, mean, median, sd, quartile}},
     *         { k, c, d, s: {max, min, sum, mean, median, sd, quartile}},
     *            . . . // one stat object for each row in the data set
     *     ]
     *
     *     where, for each grouped data
     *
     *     k: the group key,
     *     c: number of items in the group
     *     d: group data as coordinate pairs (x, y) where y is the value
     *     max: maximum y-value
     *     min: minimum y-value
     *     sum: sum of the y-values
     *     mean: mean of the y-value
     *     median: median of the y-values
     *     sd: standard deviation of the y-values
     *     quartile: 1st and 2nd quartile points for the y-values
     */
    function calculateGroupedSeriesStatistics(dataset, keyColumn,
        xColumn, yColumn, metadataGroupColumn,
        animalIdColumn, measurementIdColumn, target) {
        var s = {
            i: {}
        },
        currentKey, currentGroupKey, currentKeyGroup = [],
            currentMeasuredValueX, currentMeasuredValueY,
            i, size, xValueComparator, yValueComparator;

        s[target] = [];

        /* sort data in ascending value of key for efficient grouping */
        dataset.sort(getAttributeValueComparator(keyColumn));

        i = 1;
        size = dataset.length;

        /* first key value defines the first group */
        currentKey = currentGroupKey = dataset[0][keyColumn];

        xValueComparator = getAttributeValueComparator(xColumn);
        yValueComparator = getAttributeValueComparator(yColumn);

        /* a key-to-index table for rapid reference */
        s.i[currentGroupKey] = 0;

        /* start group with the first measured value */
        currentKeyGroup.push({
            e: dataset[0][metadataGroupColumn],
            m: dataset[0][measurementIdColumn],
            a: dataset[0][animalIdColumn],
            x: dataset[0][xColumn],
            y: dataset[0][yColumn],
            s: dataset[0].s /* sex */
        });

        while (i < size) {
            currentKey = dataset[i][keyColumn];
            currentMeasuredValueX = dataset[i][xColumn];
            currentMeasuredValueY = dataset[i][yColumn];
            if (currentKey === currentGroupKey)
                /* still the same group; value joins group */
                currentKeyGroup.push({
                    e: dataset[i][metadataGroupColumn],
                    m: dataset[i][measurementIdColumn],
                    a: dataset[i][animalIdColumn],
                    x: currentMeasuredValueX,
                    y: currentMeasuredValueY,
                    s: dataset[i].s, /* sex */
                    z: dataset[i].z, /* zygosity */
                    fi: dataset[i].fi, /* tracker id of XML file */
                    fd: dataset[i].fd /* last modified data for tracker id */
                });
            else {
                /* no longer the same group! calculate statistical data
                 * for the current group and store the row statistics. Since
                 * we want to use the group points for series plotting against
                 * the x-values, they must be sorted by the x-values */
                s[target].push({
                    k: currentGroupKey,
                    c: currentKeyGroup.length,
                    s: calculateColumnStatistics(currentKeyGroup, 'y', yValueComparator),
                    d: currentKeyGroup.sort(xValueComparator)
                });

                /* we must start a new group. the current key value defines
                 * the new group; and the only member is its measured value */
                s.i[currentKey] = s.i[currentGroupKey] + 1;
                currentGroupKey = currentKey;
                currentKeyGroup = [{
                        e: dataset[i][metadataGroupColumn],
                        m: dataset[i][measurementIdColumn],
                        a: dataset[i][animalIdColumn],
                        x: currentMeasuredValueX,
                        y: currentMeasuredValueY,
                        s: dataset[i].s, /* sex */
                        z: dataset[i].z, /* zygosity */
                        fi: dataset[i].fi, /* tracker id of XML file */
                        fd: dataset[i].fd /* last modified data for tracker id */
                    }];
            }
            ++i;
        }

        /* calculate statistics for the unprocessed group */
        if (currentKeyGroup.length > 0) {
            s[target].push({
                k: currentKey,
                c: currentKeyGroup.length,
                s: calculateColumnStatistics(currentKeyGroup, 'y', yValueComparator),
                d: currentKeyGroup.sort(xValueComparator)
            });
        }

        return s;
    }

    /**
     * Accepts a one-dimensional array of measurements and calculates the
     * various statistics required, while also preparing the data for plotting.
     *
     * @param {Object} dataset The data set, which is a one-dimensional array
     *     of objects.
     * @param {String | Integer} keyColumn The column property/index inside a
     *      data-point to use as key for grouping.
     * @param {String | Integer} xColumn The column property/index that gives
     *      the x-value.
     * @param {String | Integer} yColumn The column property/index that gives
     *      the y-value.
     * @param {String | Integer} metadataGroupColumn The column property/index
     *      that gives the unique metadata group.
     * @param {String | Integer} animalIdColumn The column property/index
     *      that gives the unique animal identifier.
     * @param {String | Integer} measurementIdColumn The column property/index
     *      that gives the unique measurement identifier.
     *
     * @return An object that contains various statistics and the data in
     *         the appropriate format required for plotting. The returned
     *         object has the following structure:
     *
     *         {
     *             c: { // group by x-values
     *                 i:, // x-value-to-group statistics object index
     *                 c: [ // group statistics when grouped using x-value
     *                 {
     *                     k: group key: which is the x-value
     *                     c: group size
     *                     d: [ y1, y2, . . . ] // y-values with same x-value
     *                     s: {
     *                         min:
     *                         max:
     *                         sum:
     *                         mean:
     *                         median:
     *                         sd:
     *                         quartile: {
     *                             q1:
     *                             q3:
     *                         }
     *                     }
     *                 },
     *                 . . . // one object for every unique x-value
     *                 ]
     *             },
     *             o: { // overall statistics
     *                 x: { // limited statistics for the x-value
     *                     min:
     *                     max:
     *                 },
     *                 y { // full statistics for the y-value
     *                     min:
     *                     max:
     *                     sum:
     *                     mean:
     *                     median:
     *                     sd:
     *                     quartile: {
     *                         q1:
     *                         q3:
     *                     }
     *                 }
     *             },
     *             r: { // group by animal Id
     *                 i:, // animalId-to-group statistics object index
     *                 r: [ // group statistics when grouped using animalId
     *                 {
     *                     k: group key: which is the animal Id
     *                     c: group size
     *                     d: [ y1, y2, . . . ] // y-values with same x-value
     *                     s: {
     *                         min:
     *                         max:
     *                         sum:
     *                         mean:
     *                         median:
     *                         sd:
     *                         quartile: {
     *                             q1:
     *                             q3:
     *                         }
     *                     }
     *                 },
     *                 . . . // one object for every unique animal Id
     *                 ]
     *             }
     *         }
     *
     */
    function prepareDatasetForPlotting(dataset, keyColumn, xColumn,
        yColumn, metadataGroupColumn, animalIdColumn, measurementIdColumn) {

        if (!dataset || dataset.length < 1)
            return null;

        /* the statistics and formatted data */
        var s = {
            'overall': {}, /* overall statistics: all for y-values, min/max for x */
            c: {}, /* column statistics where data is grouped by x-values */
            r: {} /* row statistics where data is grouped by animal id */
        }; /* temp variables */

        /* we first calculate the overall statistics for the y-values. Since
         * calculation of the median and quartiles require sorting the entire
         * data-set using the 'y' value, we have to do this separately. */
        s.overall.y = calculateColumnStatistics(dataset, yColumn,
            getAttributeValueComparator(yColumn));

        /* next, we find the column statistics of the data where the
         * measurements are grouped by their x-values */
        s.c = calculateGroupedSeriesStatistics(dataset, xColumn, xColumn,
            yColumn, metadataGroupColumn, animalIdColumn,
            measurementIdColumn, 'c');

        /* next, we find the row statistics of the data where the
         * measurements are grouped by their animal identifiers. This also
         * prepares the required data-set for series plotting against
         * animal identifier. */
        s.r = calculateGroupedSeriesStatistics(dataset, keyColumn, xColumn,
            yColumn, metadataGroupColumn, animalIdColumn,
            measurementIdColumn, 'r');

        /* finally, we derive the minimum and maximum x-values required for
         * generating the x-axis and scales. We use the column statistics
         * because the measurements have already been grouped by x-values
         * and these have already been sorted (due to the grouping). We could
         * have calculated the overall statistics for the x-values, however,
         * since only min and max are required, it will be an overkill */
        s.overall.x = {};
        s.overall.x.min = s.c.c[0].k; /* the key of the first column statistics */
        s.overall.x.max = s.c.c[s.c.c.length - 1].k; /* key of last column stat */

        return s;
    }

    /**
     * Calculates all of the descriptive statistics separated by gender.
     *
     * @param {Object} dataset The data set, which is a one-dimensional array
     *     of objects that contain both gender.
     * @param {String | Integer} keyColumn The column property/index inside a
     *      data-point to use as key for grouping.
     * @param {String | Integer} xColumn The column property/index that gives
     *      the x-value.
     * @param {String | Integer} yColumn The column property/index that gives
     *      the y-value.
     * @param {String | Integer} metadataGroupColumn The column property/index
     *      that gives the unique metadata group.
     * @param {String | Integer} animalIdColumn The column property/index
     *      that gives the unique animal identifier.
     * @param {String | Integer} measurementIdColumn The column property/index
     *      that gives the unique measurement identifier.
     */
    function calculateStatistics(dataset, keyColumn, xColumn,
        yColumn, metadataGroupColumn, animalIdColumn, measurementIdColumn) {
        if (!dataset)
            return null;
        var i, c, datapoint, maleData = [], femaleData = [];
        for (i = 0, c = dataset.length; i < c; ++i) {
            datapoint = dataset[i];
            if (datapoint.s)
                maleData.push(datapoint);
            else
                femaleData.push(datapoint);
        }
        return {
            'genderCombined': prepareDatasetForPlotting(dataset, keyColumn,
                xColumn, yColumn, metadataGroupColumn, animalIdColumn,
                measurementIdColumn),
            'male': prepareDatasetForPlotting(maleData, keyColumn, xColumn,
                yColumn, metadataGroupColumn, animalIdColumn,
                measurementIdColumn),
            'female': prepareDatasetForPlotting(femaleData, keyColumn, xColumn,
                yColumn, metadataGroupColumn, animalIdColumn,
                measurementIdColumn)
        };
    }

    /**
     * Returns the correct statistics object depending on the control setting.
     *
     * @param {Object} viz Th visualisation object.
     * @param {Boolean} forMutant If true, return mutant statistics,
     *         otherwise, return wild type statistics.
     */
    function getStatistics(viz, forMutant) {
        var statistics = null, temp = forMutant ?
            viz.state.mutantStatistics : viz.state.wildtypeStatistics;
        if (temp) {
            var showMale = viz.isActiveCtrl('male'),
                showFemale = viz.isActiveCtrl('female');
            statistics = showMale ?
                (showFemale ? temp.genderCombined : temp.male) :
                (showFemale ? temp.female : null);
        }
        return statistics;
    }

    /**
     * Returns the overall baseline statistics for combined male and female.
     *
     * @param {Object} stat Statistics object.
     * @param {Integer} gid Genotype identifier.
     * @returns {Object} Overall statistics.
     */
    function getOverallBaselineStatisticsBothGenders(stat, gid) {
        var overall = undefined;
        if (stat) {
            if (stat.genderCombined) {
                stat = stat.genderCombined;
                if (stat.overall) {
                    overall = stat.overall;
                } else {
                    if (gid !== 0)
                        console.warn('No overall wild type statistics for combined gender...');
                }
            } else {
                if (gid !== 0)
                    console.warn('No wild type statistics for combined gender...');
            }
        } else {
            if (gid !== 0)
                console.warn('No wild type statistics...');
        }
        return overall;
    }

    /**
     * Creates a frequency grid.
     *
     * @param {Integer} row Number of rows in the grid.
     * @param {Integer} col Number of columns in the grid.
     *
     * @returns {Array} Two-dimensional array frequency grid.
     */
    function createFrequencyGrid(row, col) {
        var i, j, freqGrid = [];
        for (i = 0; i < row; ++i) {
            freqGrid[i] = [];
            for (j = 0; j < col; ++j)
                freqGrid[i][j] = {
                    'm': {}, /* mutant frequency */
                    'b': {} /* wild type/control frequency */
                };
        }
        return freqGrid;
    }

    /**
     * Increments grid frequency for wild type or mutant.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     * @param {Integer} row Grid row.
     * @param {Integer} col Grid column.
     * @param {Integer} category Measured category.
     * @param {String} type Type of datum (wild type, or mutant).
     */
    function incrementCellFrequency(freqGrid, row, col, category, type) {
        var cell = freqGrid[row][col][type];
        if (cell[category] === undefined)
            cell[category] = 1; /* first specimen under this category */
        else
            cell[category] += 1;
    }

    /**
     * Processes a measurement datum. This will increment the
     * appropriate frequencies in the grid.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     * @param {Object} datum Measured categorical datum.
     */
    function processCategoricalDatum(freqGrid, datum) {
        /* genotype = 0 means wild type datum */
        var type = datum.g === 0 ? 'b' : 'm', value = datum.v;

        incrementCellFrequency(freqGrid, 4, 3, value, type);
        incrementCellFrequency(freqGrid, datum.s, datum.z, value, type);
        incrementCellFrequency(freqGrid, 4, datum.z, value, type);
        incrementCellFrequency(freqGrid, datum.s, 3, value, type);
    }

    /**
     * Calculates option percentages for wild type or mutant in a cell.
     *
     * @param {Object} freq Object with category frequencies.
     *
     * @returns {Object} An object with category percentages.
     */
    function calculateFrequencyPercentages(freq) {
        var statistics = {}, total = 0, option;

        /* calculate total */
        for (option in freq)
            total += freq[option];

        /* calculate percentage */
        for (option in freq)
            statistics[option] = (freq[option] * 100.0) / total;

        return {
            't': total,
            's': statistics
        };
    }

    /**
     * Calculates the option percentages for each of the cells. These
     * percentages are then displayed as segment bars.
     *
     * @param {Array} freqGrid Two-dimensional frequency grid.
     */
    function calculateCategoryPercentages(freqGrid) {
        var i, j, freq;
        for (i = 0, j; i < 5; ++i) {
            for (j = 0; j < 4; ++j) {
                freq = freqGrid[i][j];
                freqGrid[i][j].wildtypeStatistics =
                    calculateFrequencyPercentages(freq.b);
                freqGrid[i][j].mutantStatistics =
                    calculateFrequencyPercentages(freq.m);
            }
        }
    }

    /**
     * Process categorical data into gender/zygosity grid.
     *
     * @param {[Object]} dataset Datatset with categorical measurements.
     * @returns Returns the frequency and percentage grid for wild type/mutant
     *         and combinations of gender and zygosity. Using this grid, we can
     *         answer questions such as:
     *
     *         o What percentage of male specimens have option X?
     *         o What percentage of the wild type male homozygous specimens have
     *           option X?
     *         o What percentage of the wild type specimens have option X?
     *         
     *         Also returns a list of unique categories used in visualisation.
     *         This is used when displaying category legends.
     */
    function processCategorical(dataset) {
        /* the following grid data structure captures frequencies for each of
         * the gender, zygosity and mutant combinations.
         *
         *                  Het    Hom     Hem    All
         *        Female  (0, 0)  (0, 1)  (0,2)  (0, 3)
         *          Male  (1, 0)  (1, 1)  (1,2)  (1, 3)
         *      Intersex  (2, 0)  (2, 1)  (2,2)  (2, 3)
         *       No data  (3, 0)  (3, 1)  (3,2)  (3, 3)
         *           All  (4, 0)  (4, 1)  (4,2)  (4, 3)
         *
         * And for each cell, we collect the wild type (b) and mutant (m)
         * counts for each of the parameter options.
         */
        var freqGrid = createFrequencyGrid(5, 4), datum,
            category, categoriesInUse = {}, categories = [];
        for (var i = 0, c = dataset.length; i < c; ++i) {
            datum = dataset[i];
            processCategoricalDatum(freqGrid, datum);

            /* if categorial data is free-form without a set of options
             * specified in IMPReSS, we should assigned indexes based on
             * the values received. */
            category = datum.v;
            if (categoryColourIndex[category] === undefined)
                categoryColourIndex[category] = numCategories++;
            /* get list of unique categories used in this visulisation */
            if (categoriesInUse[category] === undefined) {
                categoriesInUse[category] = 1;
                categories.push(category);
            }
        }
        calculateCategoryPercentages(freqGrid);
        categories.sort(function (a, b) {
            return a.localeCompare(b);
        });
        categories.unshift('Highlighted specimen');
        return {
            'freqGrid': freqGrid,
            'categories': categories
        };
    }

    /**
     * Renders a circle.
     *
     * @param {Object} svg SVG node to attach circle element to.
     * @param {Integer} cx x-coordinate of the center.
     * @param {Integer} cy y-coordinate of the center.
     * @param {Integer} radius Radius of the circle.
     * @param {String} cls Class to use for the circle.
     */
    function circle(svg, cx, cy, radius, cls) {
        return svg.append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', radius)
            .attr('class', cls);
    }

    /**
     * Renders a square.
     *
     * @param {Object} svg SVG node to attach circle element to.
     * @param {Integer} cx x-coordinate of the center of the square.
     * @param {Integer} cy y-coordinate of the center of the square.
     * @param {Integer} side Length of a side.
     * @param {String} cls Class to use for the circle.
     */
    function square(svg, cx, cy, side, cls) {
        var halfSide = side * 0.5;
        return svg.append('rect')
            .attr('x', cx - halfSide)
            .attr('y', cy + halfSide)
            .attr('width', side)
            .attr('height', side)
            .attr('class', cls);
    }

    /**
     * Renders a triangle.
     *
     * @param {Object} svg SVG node to attach circle element to.
     * @param {Integer} cx x-coordinate of the center of the triangle.
     * @param {Integer} cy y-coordinate of the center of the triangle.
     * @param {Integer} side Length of a side (equilateral triangle).
     * @param {String} cls Class to use for the circle.
     */
    function triangle(svg, cx, cy, side, cls) {
        var radiusCircumcircle = side / Math.sqrt(3),
            halfSide = 0.5 * side, halfSideSquared = Math.pow(halfSide, 2),
            radiusSquared = Math.pow(radiusCircumcircle, 2),
            heightFromBase = Math.sqrt(radiusSquared - halfSideSquared),
            heightFromApex = Math.sqrt(side * side - halfSideSquared) - heightFromBase,
            points = '';
        points += (cx - halfSide) + ',' + (cy + heightFromBase) + ' ';
        points += (cx + halfSide) + ',' + (cy + heightFromBase) + ' ';
        points += cx + ',' + (cy - heightFromApex) + ' ';
        return svg.append('polygon')
            .attr('points', points)
            .attr('class', cls);
    }

    /**
     * Renders a line segment
     *
     * @param {Object} svg SVG node to attach line element to.
     * @param {Integer} x1 x-coordinate of segment start.
     * @param {Integer} y1 y-coordinate of segment start.
     * @param {Integer} x2 x-coordinate of segment end.
     * @param {Integer} y2 y-coordinate of segment end.
     * @param {String} cls Class to use for the line segment.
     */
    function line(svg, x1, y1, x2, y2, cls) {
        return svg.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .attr('class', cls);
    }

    /**
     * Renders a rectangle.
     *
     * @param {Object} svg SVG node to attach rectangular element to.
     * @param {Integer} x x-coordinate of top-left.
     * @param {Integer} y y-coordinate of top-left.
     * @param {Integer} width  Width of the rectangular element.
     * @param {Integer} height Height of the rectangular element.
     * @param {String} cls Class to use for the rectangular element.
     */
    function rect(svg, x, y, width, height, cls) {
        return svg.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('height', height)
            .attr('width', width)
            .attr('class', cls);
    }

    /**
     * Renders a text.
     *
     * @param {Object} svg SVG node to attach text element to.
     * @param {Integer} x x-coordinate of the text.
     * @param {Integer} y y-coordinate of the text.
     * @param {String} text The text to display.
     * @param {String} cls Class to use for the text segment.
     */
    function text(svg, x, y, text, cls) {
        return svg.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('class', cls)
            .text(text);
    }

    /**
     * Draws an error bar (off one standard deviation) for a given data point.
     *
     * @param {String} id Identifier to use for the error bar group.
     * @param {Object} viz The visualisation object.
     * @param {Real} x Value of property <b>x</b> for the data point.
     * @param {Real} y Value of property <b>x</b> for the data point.
     * @param {Real} deviation Deviation from data point.
     * @param {Integer} width Width of the error bar in pixels.
     *
     * @return {Object} The modified DOM element.
     */
    function plotErrorBar(id, viz, x, y, deviation, width) {
        var errorBarRootDom, /* groups all error bar components */
            svg = viz.state.n.s, visualisationScale = viz.scale,
            xScale = visualisationScale.x, yScale = visualisationScale.y,
            halfWidth = width * 0.5, /* half width: get bar offset from point */
            bottomLeftX, bottomLeftY, /* scaled bottom-left corner */
            topRightX, topRightY; /* scaled top-right corner */

        /* remove existing whisker plot group with the identifier */
        svg.selectAll('.ebar.' + id).remove();

        /* append a new series plot group */
        errorBarRootDom = svg.append('g').attr('class', 'ebar ' + id);

        /* calculate SVG screen coordinates for the vertical line and the
         * bottom-left and top-right corners */
        x = xScale(x);
        bottomLeftX = x - halfWidth;
        topRightX = x + halfWidth;

        bottomLeftY = yScale(y - deviation);
        topRightY = yScale(y + deviation);

        /* vertical line */
        line(errorBarRootDom, x, bottomLeftY, x, topRightY, 'v');

        /* min (low) */
        line(errorBarRootDom, bottomLeftX, bottomLeftY,
            topRightX, bottomLeftY, 'l');

        /* max (high) */
        line(errorBarRootDom, bottomLeftX, topRightY,
            topRightX, topRightY, 'h');
    }

    /**
     * Draws a whisker plot using the supplied statistical information.
     *
     * <p>To avoid overlapping the data points (if they are visible)
     * with the whisker plots, we displace the whisker plots to the
     * right of the data points.</p>
     *
     * @param {String} id Identifier to user for the whisker plot group.
     * @param {Object} viz The visualisatin object.
     * @param {Object} statistics The statistical information to use for plot.
     * @param {Real} groupKey Value used as the group key when calculating
     *        the supplied statistics.
     * @param {Integer} displacement Padding in pixels to use as displacement
     *        to the right of the x-value of the data point that is
     *        associated with the whisker plot.
     * @param {Integer} width Width of the whisker plot in pixels.
     * @param {String} cls The class to use for display style.
     *
     * @return {Object} The modified DOM element.
     */
    function plotBoxAndWhisker(id, viz, statistics, groupKey,
        displacement, width, cls) {
        var svg = viz.state.n.s, quartiles = statistics.quartile, onMouseover;

        if (!quartiles)
            return svg;

        var whiskerRootDom, visualisationScale = viz.scale,
            xScale = visualisationScale.x, yScale = visualisationScale.y,
            interQuartileRange, whiskerHeight, bottomLeftY, topRightY,
            halfWidth, bottomLeftX, topRightX, t, bottom, top;

        /* calculate y-coordinates of horizontal whiskers */
        if (viz.isActiveCtrl('whisker_iqr')) {
            interQuartileRange = quartiles.q3 - quartiles.q1;
            whiskerHeight = interQuartileRange * 1.5;
            bottomLeftY = yScale(quartiles.q1 - whiskerHeight);
            topRightY = yScale(quartiles.q3 + whiskerHeight);

            /* don't extend whiskers further than the extremas */
            bottom = yScale(statistics.min);
            top = yScale(statistics.max);
            if (bottom < bottomLeftY)
                bottomLeftY = bottom;
            if (top > topRightY)
                topRightY = top;
        } else {
            bottomLeftY = yScale(statistics.min);
            topRightY = yScale(statistics.max);
        }

        onMouseover = getStatisticsOnMouseEnterHandler(viz,
            convertStatisticsToTable(statistics), cls);

        /* remove existing whisker plot group with the identifier */
        svg.select('.whisker.' + cls + '.' + id).remove();

        /* append a new series plot group */
        whiskerRootDom = svg.append('g').attr('class',
            'whisker ' + id + ' ' + cls)
            .on('mouseover', onMouseover);

        /* screen x-coordinate of population giving the statistics */
        groupKey = xScale(groupKey);

        halfWidth = width * 0.5; /* half of box width */
        bottomLeftX = groupKey + displacement - halfWidth;
        topRightX = bottomLeftX + width;

        /* vertical line */
        t = bottomLeftX + halfWidth;
        line(whiskerRootDom, t, bottomLeftY, t, topRightY, 'v');

        /* +1.5 IQR */
        line(whiskerRootDom, bottomLeftX, bottomLeftY,
            topRightX, bottomLeftY, 'l');

        /* -1.5 IQR */
        line(whiskerRootDom, bottomLeftX, topRightY,
            topRightX, topRightY, 'h');

        /* box */
        t = yScale(quartiles.q3);
        rect(whiskerRootDom, bottomLeftX, t,
            width, yScale(quartiles.q1) - t);

        /* median */
        t = yScale(statistics.median);
        line(whiskerRootDom, bottomLeftX, t, topRightX, t, 'm');

        return svg;
    }

    /**
     * Draws a labelled horizontal line segment at the specified height.
     *
     * @param {Object} svg The parent D3 selected DOM element to render to.
     * @param {Integer} y Screen y-coordinate of the line.
     * @param {Integer} left Screen x-coordinate of the left end.
     * @param {Integer} right Screen x-coordinate of the right end.
     * @param {String} label Text to display as label.
     * @param {Integer} labelX Screen x-coordinate of label.
     * @param {Integer} labelY Screen y-coordinate of label.
     * @param {String} lineClass Class to use for the line.
     * @param {Function} onMouseover Event handler for when mouse enters.
     *
     * @return {Object} The modified DOM element.
     */
    function plotHorizontalLine(svg, y, left, right,
        label, labelX, labelY, lineClass, onMouseover) {
        var lineRootDom = svg.append('g').attr('class', lineClass);

        line(lineRootDom, left, y, right, y).on('mouseover', onMouseover);

        /* should we show label? */
        if (label !== null && label.length > 0)
            text(lineRootDom, labelX, labelY, label);

        return svg;
    }

    /**
     * Draws an axis with line, ticks and label.
     *
     * <p>We assume that all of the parameters are valid (i.e., we do not check
     * if they are null or undefined.</p>
     *
     * @param {String} id Identifier to user for the whisker plot group.
     * @param {Object} viz The visualisation object.
     * @param {String} orientation Axis orientation (top, right, bottom, left).
     * @param {String} label Text to use as axis label.
     *
     * @return {Object} The modified DOM element.
     */
    function plotAxis(id, viz, orientation, label) {
        var svg = viz.state.n.v;
        /* remove existing axis with the identifier */
        svg.select('.' + id + '-axis').remove();

        /* if orientation is not provided, it means remove the axis */
        if (orientation === null)
            return viz;

        var axis = {},
            paddingFromRootDom = viz.dim.p,
            dim = viz.chart.dim, domHeight = dim.h, domWidth = dim.w,
            visualisationScale = viz.scale,
            xScale = visualisationScale.x, yScale = visualisationScale.y,
            halfPadding = paddingFromRootDom * 0.5,
            quarterPadding = halfPadding * 0.5,
            threeQuarterPadding = halfPadding + quarterPadding,
            valueRange,
            labelRotationAngle = 0, labelX, labelY,
            axisBoxTopLeftX, axisBoxTopLeftY;

        switch (orientation) {
            case 'bottom':
            case 'top':
                valueRange = xScale.range();
                axisBoxTopLeftX = 0;
                labelX = axisBoxTopLeftX + domWidth * 0.5;

                if (orientation[0] === 't') {
                    axisBoxTopLeftY = threeQuarterPadding;
                    labelY = axisBoxTopLeftY - (halfPadding + quarterPadding);
                } else {
                    axisBoxTopLeftY = domHeight - threeQuarterPadding;
                    labelY = axisBoxTopLeftY + halfPadding;
                }

                /* reusing variable valueRange */
                valueRange = d3.svg.axis()
                    .scale(xScale)
                    .orient(orientation);

                /* if the x-axis values are integral, format ticks as such */
                if (viz.ptype.xt === 'i')
                    valueRange.tickFormat(d3.format("d"))
                        .tickValues(Object.keys(viz.state.mutantStatistics.genderCombined.c.i));
                break;

            case 'right':
            case 'left':
                valueRange = yScale.range();
                axisBoxTopLeftY = 0;
                labelY = domHeight * 0.5;
                if (orientation[0] === 'r') {
                    axisBoxTopLeftX = domWidth - threeQuarterPadding;
                    labelX = domWidth - (halfPadding + quarterPadding);
                    labelRotationAngle = 90;
                } else {
                    axisBoxTopLeftX = threeQuarterPadding;
                    labelX = quarterPadding;
                    labelRotationAngle = -90;
                }

                /* reusing variable valueRange */
                valueRange = d3.svg.axis()
                    .scale(yScale)
                    .orient(orientation);

                /* if the y-axis values are integral, format ticks as such */
                if (viz.ptype.yt === 'i') {
                    valueRange.tickFormat(d3.format("d")).tickSubdivide(0);
                }
        }

        /* append a new axis root */
        axis[id] = {};

        /* reusing variable domHeight */
        domHeight = svg.append('g').attr('class', id + '-axis');

        /* append line, ticks and values */
        axis.tick = domHeight.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(' +
                axisBoxTopLeftX + ',' + axisBoxTopLeftY + ')')
            .call(valueRange);

        /* append label */
        axis.label = domHeight.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('transform', 'rotate(' +
                labelRotationAngle + ',' + labelX + ',' + labelY + ' ' + ')')
            .text(label);

        axis.root = domHeight;
        viz.state.n.a[id] = axis;

        return svg;
    }

    function convertStatisticsToTable(stat) {
        var m = '<table><tbody>';
        m += '<tr><td>Mean:</td><td>' + toDisplayPrecision(stat.mean) + '</td></tr>';
        m += '<tr><td>Median:</td><td>' + toDisplayPrecision(stat.median) + '</td></tr>';
        if (stat.quartile) {
            m += '<tr><td>1st quartile:</td><td>' + toDisplayPrecision(stat.quartile.q1) + '</td></tr>';
            m += '<tr><td>3rd quartile:</td><td>' + toDisplayPrecision(stat.quartile.q3) + '</td></tr>';
        }
        m += '<tr><td>Minimum:</td><td>' + toDisplayPrecision(stat.min) + '</td></tr>';
        m += '<tr><td>Maximum:</td><td>' + toDisplayPrecision(stat.max) + '</td></tr>';
        if (stat.sd)
            m += '<tr><td>Std. deviation:</td><td>' + toDisplayPrecision(stat.sd) + '</td></tr>';
        if (stat.se)
            m += '<tr><td>Std. error:</td><td>' + toDisplayPrecision(stat.se) + '</td></tr>';
        return m + '</tbody></table>';
    }

    /**
     * Draws the overall statistical information for the entire data set.
     *
     * @param {Object} viz The visualisation object.
     * @param {Object} statistics The statistical information to use for plot.
     * @param {Integer} [padding] Label padding (pixels) from line right-end.
     * @param {Boolean} isBaseline Is the plot for wild type data?
     *
     * @return {Object} The modified DOM element.
     */
    function plotStatistics(viz, statistics, padding, isBaseline) {
        var svg = viz.state.n.s,
            scale = viz.scale, yScale = scale.y,
            xRange = scale.x.range(),
            xDomain = scale.x.domain(),
            labelX,
            meanY = yScale(statistics.mean),
            medianY = yScale(statistics.median), deviation, cls,
            offsetMeanY = 0, offsetMedianY = 0, onMouseover;

        /* prevent mean and median labels from overlapping */
        if (meanY > medianY)
            offsetMeanY = 10;
        else
            offsetMedianY = 10;

        onMouseover = getStatisticsOnMouseEnterHandler(viz,
            convertStatisticsToTable(statistics),
            isBaseline ? 'wildtype' : 'mutant');

        /* label displacement from end of line */
        if (padding)
            labelX = xRange[1] + padding;

        if (viz.isActiveCtrl('mean')) {
            if (isBaseline)
                plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'mean (WT)', labelX, meanY + offsetMeanY,
                    'wildtype-mean', onMouseover);
            else
                plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'mean', labelX, meanY + offsetMeanY,
                    'mean', onMouseover);

            if (viz.isActiveCtrl('errorbar')) {
                deviation = viz.isActiveCtrl('std_err')
                    ? statistics.se : statistics.sd;
                cls = isBaseline ? 'wildtype' : 'mutant';
                plotErrorBar(cls, viz, xDomain[1], statistics.mean, deviation, 20);
            }
        }

        if (viz.isActiveCtrl('median')) {
            if (isBaseline)
                plotHorizontalLine(svg, medianY, xRange[0], xRange[1],
                    'median (WT)', labelX, medianY + offsetMedianY,
                    'wildtype-median', onMouseover);
            else
                plotHorizontalLine(svg, medianY, xRange[0], xRange[1],
                    'median', labelX, medianY + offsetMedianY,
                    'median', onMouseover);
        }

        if (viz.isActiveCtrl('quartile')) {
            if (statistics.quartile !== null) {
                /* reusing variable meanY */
                meanY = yScale(statistics.quartile.q1);

                if (isBaseline)
                    plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        'Q1 (WT)', labelX, meanY, 'wildtype-q1', onMouseover);
                else
                    plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        'Q1', labelX, meanY, 'q1', onMouseover);

                /* reusing variable meanY */
                meanY = yScale(statistics.quartile.q3);
                if (isBaseline)
                    plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        'Q3 (WT)', labelX, meanY, 'wildtype-q3', onMouseover);
                else
                    plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                        'Q3', labelX, meanY, 'q3', onMouseover);
            }
        }

        if (viz.isActiveCtrl('max')) {
            /* reusing variable meanY */
            meanY = yScale(statistics.max);
            if (isBaseline)
                plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'max (WT)', labelX, meanY + offsetMeanY,
                    'wildtype-max', onMouseover);
            else
                plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'max', labelX, meanY + offsetMeanY,
                    'max', onMouseover);
        }

        if (viz.isActiveCtrl('min')) {
            /* reusing variable meanY */
            meanY = yScale(statistics.min);
            if (isBaseline)
                plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'min (WT)', labelX, meanY + offsetMeanY,
                    'wildtype-min', onMouseover);
            else
                plotHorizontalLine(svg, meanY, xRange[0], xRange[1],
                    'min', labelX, meanY + offsetMeanY,
                    'min', onMouseover);
        }

        return svg;
    }

    /**
     * Displays a crosshair with horizontal and vertical line segments that
     * intersects at the mouse pointer position. The crosshair consists of
     * four parts, so that the intersection points does not coincide with
     * the mouse pointer coordinate. This prevents events from misfiring.
     *
     * @param {Object} viz The visualisation object.
     *
     * @return {Object} The modified DOM element.
     */
    function renderCrosshair(viz) {
        var svg = viz.state.n.v, xhair;

        /* group cross hair components and hide it during creation */
        svg.selectAll('.xhair').remove();
        xhair = svg.append('g').attr('class', 'xhair');

        /* crosshair horizontal line segment */
        xhair.horizontalLeft = line(xhair, 0, 0, 0, 0);
        xhair.horizontalRight = line(xhair, 0, 0, 0, 0);

        /* crosshair vertical line segment */
        xhair.verticalTop = line(xhair, 0, 0, 0, 0);
        xhair.verticalBottom = line(xhair, 0, 0, 0, 0);

        svg.xhair = xhair;
        return svg;
    }

    /**
     * Convert radian to degrees.
     *
     * @param {Real} radian Angle in radian.
     * @returns Angle in degree.
     */
    function getDegreeFromRadian(radian) {
        return (180 * radian) / Math.PI;
    }

    /**
     * Returns percentage of Pie.
     *
     
     * @param {Real} start Start angle in radian.
     * @param {Real} end End angle in radian.
     * @returns Percentage of pie segment.
     */
    function getPiePercentage(start, end) {
        var deg = getDegreeFromRadian(end - start);
        return (deg * 100) / 360;
    }

    /**
     * Render's a pie chart.
     *
     * @param {Object} svg SVG container.
     * @param {Object} data Pie chart data.
     * @param {String} label Label to display at the bottom of pie.
     */
    function renderPie(svg, data, label) {
        var labelHeight = 35, w = width(svg), h = height(svg) - labelHeight,
            radius = Math.min(w, h) / 2, g, total = 0,
            arc = d3.svg.arc().outerRadius(radius).innerRadius(0),
            colour = d3.scale.ordinal().range(pieColours),
            pie = d3.layout.pie().sort(null)
            .value(
                function (d) {
                    total += d.v;
                    return d.v;
                });

        svg = svg.append("g")
            .attr("transform", "translate(" + w / 2 + "," + h / 2 + ")");

        g = svg.selectAll(".arc").data(pie(data))
            .enter().append("g").attr("class", "arc")
            .attr("percentage", function (d) {
                return getPiePercentage(d.startAngle, d.endAngle);
            });

        g.append("path").attr("d", arc)
            .style("fill",
                function (d) {
                    return colour(d.data.l);
                });
        g.append("text")
            .attr("transform",
                function (d) {
                    return "translate(" + arc.centroid(d) + ")";
                })
            .attr('class', 'pie-piece-label')
            .text(function (d) {
                var percentage = d.data.v * 100 / total;
                return percentage.toFixed(2) > 0 ? d.data.l : '';
            });
        g.append("text")
            .attr("transform",
                function (d) {
                    return "translate(" + arc.centroid(d) + ")";
                })
            .attr("dy", "1.25em")
            .attr('class', 'pie-percentage')
            .text(function (d) {
                var percentage = d.data.v * 100 / total;
                percentage = percentage.toFixed(2);
                return percentage > 0 ? percentage + '%' : '';
            });
        text(svg, 0, radius + labelHeight / 2, label, 'pie-label');
    }

    /**
     * Returns a collection of SVG container to contain specified number of
     * pie charts.
     *
     * @param {Object} node Parent DOM node that will contain the pie charts.
     * @param {type} count Number of pie chart of fit inside the parent.
     * @param {String} orientation How should the pies be oriented.
     * @param {Boolean} isParentChild In a parent child relationship, we
     *     display the data split between parent pie and children pie.
     * @param {Real} shrinkFactor Child/parent pie radius ratio.
     * @param {Integer} gapSize Size of the gap between pies.
     * @returns {Array} Returns an array of SVG containers.
     */
    function getPiesContainer(node, count, orientation,
        isParentChild, shrinkFactor, gapSize) {
        var w = width(node), h = height(node), i, containers = [], t, e = 0,
            numGaps; /* insert gaps between pies */
        if (isParentChild) {
            numGaps = count - 1;
            w -= gapSize * numGaps;
        }
        switch (orientation) {
            case 'v': /* pies should be aligned vertically in a column */
                h /= count;
                break;
            case 'h':
            default: /* pies should be aligned horizontally in a row */
                w /= count;
                break;
        }
        if (isParentChild)
            count += numGaps;
        for (i = 0; i < count; ++i) {
            t = i % 2 ? gapSize : w;
            e += t;
            containers[i] = node.append("svg")
                .attr("width", t)
                .attr("height", h);
            if (isParentChild && i === 0)
                w *= shrinkFactor; /* all following pies are children */
        }
        node.style('padding-left', ((width(node) - e) / 2) + 'px');
        return containers;
    }

    /**
     * Display tabular data
     * 
     * @param {Object} parent Container DOM node.
     * @param {String} procedure Procedure to display.
     * @param {Object} embryoStage Embryo stage if embryo data; otherwise, null.
     */
    function plotTabularData(parent, procedure, embryoStage) {
        parent.classed('loading', false);
        var data = measurementsSet[ZYGOSITY_ALL],
            key, d, tr, title, table, stage, header, container;

        if (data === null)
            return;

        title = addDiv(parent, null, 'tabular-title');
        stage = addDiv(parent, null, 'tabular-stage');
        header = addDiv(parent, null, 'tabular-table-header');
        container = addDiv(parent, null, 'tabular-table-container');

        title.html('<span>' +
            (embryoStage ? 'Embryo ' : 'Adult ') + procedure +
            ' procedure</span>' +
            '<span>Combines multiple parameters</span>');
        table = header.append('table');
        tr = table.append('thead').append('tr');
        tr.append('th').text("Parameter Key");
        tr.append('th').text("Name");
        tr.append('th').text("Value");

        table = container.append('table');
        table = table.append('tbody');
        for (key in data) {
            d = data[key];
            tr = table.append('tr').classed('odd', key % 2);
            tr.append('td').text(d.key);
            tr.append('td').text(d.name);
            tr.append('td').text(d.value);
        }

        if (embryoStage)
            stage.html('<span>Stage:</span><span>' + embryoStage.s + '</span>');

        parent.refit = function () {
            height(container, height(parent) - height(title) - height(stage));
        };
        parent.refit();
    }

    /**
     * Retrieves viability data from the server and displays them in the
     * visualisation cluster. Calculations are cached for future
     * references.
     *
     * @param {Integr} id Visualisation identifier.
     * @param {Object} target Visualisation container DOM node.
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Srain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {Integer} lid Pipeline identifier.
     * @param {String} peid Procedure key.
     */
    function retrieveAndVisualiseViabilityData(id, target, gid, sid, cid, lid, peid) {
        if (typeof retrieveViabilityRequest.abort === 'function')
            retrieveViabilityRequest.abort();
        retrieveViabilityRequest = d3.json('rest/viability?' +
            'u=' + dcc.roles.uid +
            '&s=' + dcc.roles.ssid +
            '&cid=' + cid +
            '&lid=' + lid +
            '&gid=' + gid +
            '&sid=' + sid +
            '&peid=' + peid,
            function (data) {
                if (data && data.success) {
                    measurementsSet[ZYGOSITY_ALL] = data.viability;
                    if (measurementsSet[ZYGOSITY_ALL])
                        plotTabularData(target, "viability", null);
                    else
                        noMeasurementsToVisualise();
                } else
                    noMeasurementsToVisualise();
            });
    }

    /**
     * Retrieves embryo viability data from the server and displays them in the
     * visualisation cluster. Calculations are cached for future
     * references.
     * 
     * @param {Integr} id Visualisation identifier.
     * @param {Object} target Visualisation container DOM node.
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Srain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {String} qeid Parameter key.
     * @param {Object} embryoStage Embryo stage object; otherwise, null.
     */
    function retrieveAndVisualiseEmbryoViabilityData(id, target, gid, sid, cid, qeid, embryoStage) {
        if (typeof retrieveViabilityRequest.abort === 'function')
            retrieveViabilityRequest.abort();
        retrieveViabilityRequest = d3.json('rest/embryo-viability?' +
            'u=' + dcc.roles.uid +
            '&s=' + dcc.roles.ssid +
            '&cid=' + cid +
            '&gid=' + gid +
            '&sid=' + sid +
            '&stage=' + embryoStage.k,
            function (data) {
                if (data && data.success) {
                    measurementsSet[ZYGOSITY_ALL] = data.viability;
                    if (measurementsSet[ZYGOSITY_ALL])
                        plotTabularData(target, "viability", embryoStage);
                    else
                        noMeasurementsToVisualise();
                } else
                    noMeasurementsToVisualise();
            });
    }

    /**
     * Retrieves fertility data from the server and displays them in the
     * visualisation cluster. Calculations are cached for future
     * references.
     *
     * @param {Integr} id Visualisation identifier.
     * @param {Object} target Visualisation container DOM node.
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Srain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {Integer} lid Pipeline identifier.
     * @param {String} peid Procedure key.
     */
    function retrieveAndVisualiseFertilityData(id, target, gid, sid, cid, lid, peid) {
        if (typeof retrieveFertilityRequest.abort === 'function')
            retrieveFertilityRequest.abort();
        retrieveFertilityRequest = d3.json('rest/fertility?' +
            'u=' + dcc.roles.uid +
            '&s=' + dcc.roles.ssid +
            '&cid=' + cid +
            '&lid=' + lid +
            '&gid=' + gid +
            '&sid=' + sid +
            '&peid=' + peid,
            function (data) {
                if (data && data.success) {
                    measurementsSet[ZYGOSITY_ALL] = data.fertility;
                    if (measurementsSet[ZYGOSITY_ALL])
                        plotTabularData(target, "fertility", null);
                    else
                        noMeasurementsToVisualise();
                } else
                    noMeasurementsToVisualise();
            });
    }

    /**
     * Prpare a unique identifier for gene/strain and centre.
     *
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Strain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {Integer} lid Pipeline identifier.
     * @returns {String} Unique identifier for the gene/strain.
     */
    function prepareGeneStrainCentrePipelineId(gid, sid, cid, lid) {
        return gid + '-' + sid + '-' + cid + '-' + lid;
    }

    /**
     * Process measurements returned by the server.
     *
     * @param {Object} data Measurements returned by the server,
     * @param {Integer} gid Genotype identifier.
     */
    function processMeasurements(data, gid) {
        var datum, i = 0, c = data.length, isWildtype = gid === 0,
            plotType = dcc.plotType,
            mutantDataset = [], wildtypeDataset = [],
            mutantStatistics, wildtypeStatistics, temp = null;
        while (i < c) {
            datum = data[i++];
            if (datum.g === 0)
                wildtypeDataset.push(datum);
            else
                mutantDataset.push(datum);
        }

        /**
         * To simplify visualisation code, assume that wildtype data is mutant
         * data if we are only visualising wildtype. */
        if (isWildtype)
            mutantDataset = wildtypeDataset;

        if (plotType.t !== 'nominal') {
            mutantDataset = processData(mutantDataset, plotType);
            if (!isWildtype)
                wildtypeDataset = processData(wildtypeDataset, plotType);
        }

        switch (plotType.t) {
            case 'series':
                mutantStatistics =
                    calculateStatistics(mutantDataset, 'a', 'x', 'y', 'e', 'a', 'm');
                if (!isWildtype)
                    wildtypeStatistics =
                        calculateStatistics(wildtypeDataset, 'a', 'x', 'y', 'e', 'a', 'm');
                break;

            case 'point':
                mutantStatistics =
                    calculateStatistics(mutantDataset, 'a', 'd', 'y', 'e', 'a', 'm');
                if (!isWildtype)
                    wildtypeStatistics =
                        calculateStatistics(wildtypeDataset, 'a', 'd', 'y', 'e', 'a', 'm');
                break;

            case 'nominal':
                mutantStatistics = processCategorical(data);
                wildtypeStatistics = undefined;
                break;
        }

        temp = {
            'plottype': plotType,
            'mutant': {
                'dataset': mutantDataset,
                'statistics': mutantStatistics
            },
            'wildtype': {
                'dataset': wildtypeDataset,
                'statistics': wildtypeStatistics
            }
        };
        return temp;
    }

    dcc.loadCitedDatapoints = function () {
        if (dcc.dataContext.iid !== null) {
            showCitedDatapointsNotification();
            if (typeof citedDataPointRequest.abort === 'function')
                citedDataPointRequest.abort();
            citedDataPointRequest = d3.json('rest/citeddatapoints/' + dcc.dataContext.iid
                + '?u=' + dcc.roles.uid
                + '&s=' + dcc.roles.ssid,
                function (data) {
                    hideCitedDatapointsNotification();
                    if (data) {
                        setCitedDatapoints(data);
                        if (dcc.viz)
                            dcc.viz.refresh();
                    }
                });
        } else {
            selectedDatapoints.reset();
            dcc.viz.refresh();
        }
    };

    function getMetadataValuesRow(row, key, value, groupIdx) {
        return '<tr class="' + (row % 2 ? 'odd' : 'even')
            + (groupIdx === undefined ? '"><td>' :
                '"><td class="metadata-group-idx">'
                + (groupIdx + 1) + '</td><td>')
            + key + '</td><td>'
            + (value === undefined ? 'missing - not supplied' : value) + '</td></tr>';
    }

    function getMetadataValuesHeader(title, showGroup) {
        return '<div class="metadata-details-title">' + title + '</div>'
            + '<table><thead><thead>'
            + (showGroup ? '<td class="metadata-group-idx">Group</td>' : '')
            + '<td>Parameter</td><td>Value</td></thead><tbody>';
    }

    function getMetadataDetails() {
        var mg = metadataGroups, common = {}, msg,
            groupCount = 0, diffRowCount = 0, commonRowCount = 0,
            commonValues = '',
            diffValues = getMetadataValuesHeader('Differing values', true);

        if (mg.groups.length === 0)
            return '<div class="metadata-details-warning">'
                + 'Metadata required for analysis are unavailable</div>';

        /* set the common values */
        for (var grp in mg.groups) {
            var keyValues = mg.groups[grp].v;
            for (var key in keyValues) {
                if (!mg.diffSet[key])
                    commonValues += getMetadataValuesRow(commonRowCount++,
                        key, keyValues[key]);
            }
        }
        commonValues += '</tbody></table>';

        /* set differing values */
        for (var key in mg.diffSet) {
            for (var grp in mg.groups) {
                var keyValues = mg.groups[grp].v;
                diffValues += getMetadataValuesRow(diffRowCount++,
                    key, keyValues[key], groupCount);
                groupCount++;
            }
        }
        diffValues += '</tbody></table>';

        if (diffRowCount > 0) {
            msg = diffValues;
            if (commonRowCount > 0) {
                msg += getMetadataValuesHeader('Common values');
                msg += commonValues;
            }
        } else {
            msg = getMetadataValuesHeader('No metadata split');
            if (commonRowCount > 0)
                msg += commonValues;
        }
        return '<div id="metadata-details">' + msg + '</div>';
    }

    function displayMetadata() {
        Ext.getCmp('data-view-metadata-panel').update(getMetadataDetails());
    }

    function clearMetadata() {
        Ext.getCmp('data-view-metadata-panel')
            .update('<div class="no-metadata-details">No meta-data information available</div>');
    }

    /**
     * Visualise the measurements by instantiating a visualistion object.
     *
     * @param {Integer} id Visualisation identifier.
     * @param {Object} target Visualisation container DOM node.
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Strain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {Integer} lid Pipeline identifier.
     * @param {String} qeid Parameter key.
     */
    function visualiseData(id, target, gid, sid, cid, lid, qeid) {
        target.classed('loading', false);
        dcc.viz = new Visualisation(id, target, gid, sid, cid, lid, qeid, true);
        numberInitiallyCited = 0;
        dcc.loadCitedDatapoints();
        displayMetadata();
    }

    /**
     * Split the measurements into zygosity groups. This is then used to
     * calculate zygosity specific statistical calculations.
     *
     * @param {Object} data Array of measurements.
     * @returns {Object} Object that contains measurements in zygosity groups.
     */
    function groupMeasurementsByZygosity(data) {
        var datum, hom = [], het = [], hem = [], i = 0, c = data.length;
        while (i < c) {
            datum = data[i++];
            if (datum.g === 0) {
                het.push(datum);
                hom.push(datum);
                hem.push(datum);
            } else {
                switch (datum.z) {
                    case 0:
                        het.push(datum);
                        break;
                    case 1:
                        hom.push(datum);
                        break;
                    case 2:
                        hem.push(datum);
                }
            }
        }
        return {
            'het': het,
            'hom': hom,
            'hem': hem
        };
    }

    function processMeasurementsSplitByZygosity(data, id, target, gid,
        sid, cid, lid, peid, qeid) {
        var measurementGroups, processedMeasurements, dataset, datum, i;

        /* update metadata groups */
        metadataGroups.diffSet =
            prepareMetadataGroups(data.metadataGroups);
        metadataGroups.groups = data.metadataGroups;

        /* process without filtering for zygosity */
        processedMeasurements =
            processMeasurements(data.measurements, gid);
        measurementsSet[ZYGOSITY_ALL] = processedMeasurements;

        dataset = processedMeasurements.mutant.dataset;
        for (i in dataset) {
            datum = dataset[i];
            measurementLookUpTable[datum.m] = {
                'x': (datum.y === undefined ? new Date(datum.d) : datum.x),
                'y': (datum.y === undefined ? datum.v : datum.y)
            };
        }

        /* split data set by zygosity */
        measurementGroups =
            groupMeasurementsByZygosity(data.measurements);

        /* process heterozygous dataset */
        measurementsSet[ZYGOSITY_HET] =
            processMeasurements(measurementGroups.het, gid);

        /* process homozygous dataset */
        measurementsSet[ZYGOSITY_HOM] =
            processMeasurements(measurementGroups.hom, gid);

        /* process hemizygous dataset */
        measurementsSet[ZYGOSITY_HEM] =
            processMeasurements(measurementGroups.hem, gid);

        visualiseData(id, target, gid, sid, cid, lid, peid, qeid);
    }

    function noMeasurementsToVisualise() {
        var viz = d3.select('#specimen-centric-visualisation');
        viz.selectAll('*').remove();
        viz.append('div')
            .attr('class', 'no-measurements')
            .text('No measurements to visualise');
    }

    /**
     * Retrieves raw measurements from the server and displays them in the
     * visualisation cluster. All calculations are also cached for future
     * references.
     *
     * @param {Integr} id Visualisation identifier.
     * @param {Object} target Visualisation container DOM node.
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Srain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {Integer} lid Pipeline identifier.
     * @param {String} peid Procedure key.
     * @param {String} qeid Parameter key.
     */
    function retrieveAndVisualiseData(id, target, gid, sid, cid, lid, peid, qeid) {
        if (typeof retrieveMeasurementsRequest.abort === 'function')
            retrieveMeasurementsRequest.abort();
        retrieveMeasurementsRequest = d3.json('rest/measurements/extjs?' +
            'u=' + dcc.roles.uid +
            '&s=' + dcc.roles.ssid +
            '&cid=' + dcc.dataContext.cid +
            '&lid=' + dcc.dataContext.lid +
            '&gid=' + dcc.dataContext.gid +
            '&sid=' + dcc.dataContext.sid +
            '&pid=' + dcc.dataContext.pid +
            '&peid=' + dcc.dataContext.peid +
            '&qid=' + dcc.dataContext.qid +
            '&qeid=' + dcc.dataContext.qeid +
            '&ib=true',
            function (data) {
                measurementLookUpTable = {};
                selectedDatapoints.reset();
                if (data && data.success) {
                    processMeasurementsSplitByZygosity(data,
                        id, target, gid, sid, cid, lid, peid, qeid);
                } else {
                    noMeasurementsToVisualise();
                }
            });
    }

    function getEmbryoStage(key) {
        if (key.indexOf('_EVL_') !== -1)
            return {
                's': 'E9.5',
                'k': 'EVL'
            };
        else if (key.indexOf('_EVM_') !== -1)
            return {
                's': 'E12.5',
                'k': 'EVM'
            };
        else if (key.indexOf('_EVO_') !== -1)
            return {
                's': 'E14.5 - E15.5',
                'k': 'EVO'
            };
        else if (key.indexOf('_EVP_') !== -1)
            return {
                's': 'E18.5',
                'k': 'EVP'
            };
        else
            return null;
    }

    function plotParameter(id, target, gid, sid, cid, lid, peid, qeid) {
        var plotType = dcc.plotType, ctx = dcc.dataContext;
        target.attr('id', id);
        clearMetadata();
        if (plotType.t === 'image') {
            dcc.viz = null;
            dcc.imageViewer = new dcc.ComparativeImageViewer('content',
                {
                    title: '<b>' + plotType.l + '</b> (' + plotType.yl + ')',
                    /* 'imageviewer' is an instance of 'phenodcc-imaging-display'
                     * project hosted on the same server as the QC tool. */
                    host: '/imageviewer/',
                    toolbar: d3.select('#sidebar #controls'),
                    splitType: 'vertical'
                });
            dcc.imageViewer.view(ctx.cid, ctx.gid, ctx.sid, ctx.qeid, ctx.pid, ctx.lid);
        } else {
            if (dcc.imageViewer) {
                dcc.imageViewer.clear();
                dcc.imageViewer = null;
            }

            var embryoStage = null;
            if (qeid !== undefined)
                embryoStage = getEmbryoStage(qeid);

            if (embryoStage) {
                retrieveAndVisualiseEmbryoViabilityData(id, target, gid, sid, cid, qeid, embryoStage);
            } else if (qeid.indexOf('_VIA_') !== -1) {
                retrieveAndVisualiseViabilityData(id, target, gid, sid, cid, lid, peid, qeid);
            } else if (qeid.indexOf('_FER_') !== -1) {
                retrieveAndVisualiseFertilityData(id, target, gid, sid, cid, lid, peid, qeid);
            } else {
                retrieveAndVisualiseData(id, target, gid, sid, cid, lid, peid, qeid);
            }
        }
    }

    dcc.refreshImageViewer = function () {
        refitContent();
        if (dcc.imageViewer !== null)
            dcc.imageViewer.refit();
    };

    /**
     * Gets the bounded mouse coordinate.
     *
     * @param {Object} viz Visualisation object which has coordinate bounds.
     */
    function getBoundedMouseCoordinate(viz) {
        var dom = viz.container.node(), dim = dom.getBoundingClientRect(),
            screenMousePointerCoordinate = d3.mouse(dom),
            mouseX = screenMousePointerCoordinate[0],
            mouseY = screenMousePointerCoordinate[1],
            scale = viz.scale, xScale = scale.x, yScale = scale.y,
            xRange = xScale.range(), yRange = yScale.range(),
            rangeLowX = xRange[0], rangeHighX = xRange[1],
            rangeLowY = yRange[0], rangeHighY = yRange[1],
            boundedCoordX, boundedCoordY, isInside;

        /* x-coordinate increases left to right */
        boundedCoordX = mouseX < rangeLowX ? rangeLowX
            : mouseX > rangeHighX ? rangeHighX : mouseX;

        /* y-coordinate increases top to bottom */
        boundedCoordY = mouseY > rangeLowY ? rangeLowY
            : mouseY < rangeHighY ? rangeHighY : mouseY;

        /* is the mouse coordinate inside the bounded region */
        isInside = boundedCoordX === mouseX && boundedCoordY === mouseY;

        return {
            'isInside': isInside,
            'originX': dim.left,
            'originY': dim.top,
            'boundedCoordX': boundedCoordX,
            'boundedCoordY': boundedCoordY,
            'mouseX': mouseX,
            'mouseY': mouseY,
            'rangeLowX': rangeLowX,
            'rangeHighX': rangeHighX,
            'rangeLowY': rangeLowY,
            'rangeHighY': rangeHighY
        };
    }

    /**
     * Attaches an event handler which gets activated when the mouse moves
     * on top of the main SVG canvas. This will relocate the the infobox
     * near the mouse pointer, and also update the position of the crosshair.
     *
     * @param {Object} viz The visualisation object.
     *
     * @return {Object} The modified DOM element.
     */
    function svgMouseventHandler(viz) {
        var svg = viz.state.n.v, xhair = svg.xhair,
            extend = viz.dim.p * 1 / 4 - 1;
        svg.on('mouseover',
            function () {
                preventEventBubbling();
                if (xhair)
                    xhair.style('opacity', 1);
                hideInformationBox();
            })
            .on('mouseout',
                function () {
                    preventEventBubbling();
                    if (xhair)
                        xhair.style('opacity', 0);
                })
            .on('mousemove',
                function () {
                    var bmc = getBoundedMouseCoordinate(viz);

                    if (xhair) {
                        /* position horizontal line */
                        xhair.horizontalLeft
                            .attr('x1', bmc.rangeLowX - extend)
                            .attr('x2', bmc.boundedCoordX - 5)
                            .attr('y1', bmc.boundedCoordY)
                            .attr('y2', bmc.boundedCoordY);
                        xhair.horizontalRight
                            .attr('x1', bmc.boundedCoordX + 5)
                            .attr('x2', bmc.rangeHighX + extend)
                            .attr('y1', bmc.boundedCoordY)
                            .attr('y2', bmc.boundedCoordY);

                        /* position vertical line */
                        xhair.verticalTop
                            .attr('x1', bmc.boundedCoordX)
                            .attr('x2', bmc.boundedCoordX)
                            .attr('y1', bmc.rangeHighY - extend)
                            .attr('y2', bmc.boundedCoordY - 5);
                        xhair.verticalBottom
                            .attr('x1', bmc.boundedCoordX)
                            .attr('x2', bmc.boundedCoordX)
                            .attr('y1', bmc.boundedCoordY + 5)
                            .attr('y2', bmc.rangeLowY + extend);
                    }
                });
        return svg;
    }

    /**
     * Draws a series using a onedimensional array of (x, y) values.
     *
     * @param {String} id Series identifier.
     * @param {Object[]} dataset A two dimensional array with the numerical
     *     data points.
     * @param {Function} getUnscaled Function that returns unscaled <b>x</b>
     *     and <b>y</b> values from the dataset.
     * @param {Object} viz The visualisation object.
     * @param {Object} svg The SVG DOM node to render to.
     * @param {Function} onClick Data point on mouse click handler.
     * @param {Function} onMouseenter Data point on mouse enter handler.
     * @param {Function} onMousemove Data point on mouse move handler.
     * @param {Boolean} displayDataPoint If <b>true</b>, display data points.
     * @param {Boolean} displaySeriesPolyline If <b>true</b>, display the
     *     series polyline.
     * @param {String} shape What shape to use for data point.
     * @param {Integer} size A single measure for the size of the shape in
     *     pixels; for instance, radius of the data point circle; or length of
     *     the side of a square.
     *
     * @return {Object} The modified DOM element.
     */
    function plotSeries(id, dataset, getUnscaled, viz, svg,
        onClick, onMouseenter, onMousemove, displayDataPoint,
        displaySeriesPolyline, shape, size) {
        var seriesRootDom, i, polylinePoints, polyline,
            xScale = viz.scale.x, yScale = viz.scale.y,
            dataPoint, dataPointArray, t, displacement = 10,
            highlightType = getDatapointHighlightType(viz);

        /* remove existing series plot group with the identifier */
        svg.select('.series.' + id).remove();

        /* append a new series plot group */
        seriesRootDom = svg.append('g').attr('class', 'series ' + id);

        /* prepare points for SVG polyline using series data points */
        polylinePoints = '';
        dataPointArray = [];
        for (i = 0; i < dataset.length; ++i) {
            t = getUnscaled(dataset[i]);

            /* don't plot point if y-value is undefined */
            if (t.y === null)
                continue;
            dataPoint = {
                e: t.e, /* metadata group */
                m: t.m, /* measurement id */
                a: t.a, /* animal id */
                x: t.x, /* unscaled values */
                y: t.y,
                sx: xScale(t.x), /* scaled values */
                sy: yScale(t.y),
                fi: t.fi, /* tracker id of XML file */
                fd: t.fd /* last modified data for tracker id */
            };
            dataPointArray.push(dataPoint);
            polylinePoints += dataPoint.sx + ',' + dataPoint.sy + ' ';
        }

        /* draw SVG polyline through all series data points */
        if (displaySeriesPolyline) {
            polyline = seriesRootDom.append('polyline')
                .attr('points', polylinePoints);
            /* allow polyline to select specimen series data points */
            if (id === 'highlighted') {
                polyline
                    .on('mouseover', function () {
                        preventEventBubbling();
                        relocateInformationBox(getBoundedMouseCoordinate(viz));
                        informationBox.html('Click to select or unselect '
                            + 'all datapoints in this series')
                            .attr('class', 'select-series-datapoints-tip');
                    })
                    .on('click', function () {
                        preventEventBubbling();
                        /* we need one data point to call the on click function.
                         * it does not matter which datapoint because all of
                         * the datapoints in that series will either be selected
                         * of unselected. */
                        onClick(dataPoint);
                    });
            }
        }

        /* draw the series data points */
        var db = seriesRootDom.selectAll('circle').data(dataPointArray);

        db.exit().remove(); /* remove existing points */

        /* show data points? */
        if (displayDataPoint) {
            switch (shape) {
                case 't': /* text symbol */
                    db.enter()
                        .append('text')
                        .attr('mg', function (d) {
                            return d.e; /* metadata group */
                        })
                        .attr('mid', function (d) {
                            return d.m; /* measurement id */
                        })
                        .attr('aid', function (d) {
                            return d.a; /* animal id */
                        })
                        .attr('x',
                            function (d) {
                                return d.sx;
                            })
                        .attr('y',
                            function (d) {
                                return d.sy;
                            })
                        .text(size)
                        .classed('selected',
                            function (d) {
                                var v = false;
                                if (highlightType !== 'n')
                                    v = selectedDatapoints.contains(d.m);
                                return v;
                            })
                        .classed('highlight' + (highlightType ? '-' + highlightType : ''),
                            function (d) {
                                return isHighlightDatapoint(highlightType, d);
                            })
                        .on('click', onClick)
                        .on('mouseenter', onMouseenter)
                        .on('mousemove', onMousemove);
                    break;

                case 'c': /* draw circle */
                    db.enter()
                        .append('circle')
                        .attr('mg', function (d) {
                            return d.e; /* metadata group */
                        })
                        .attr('mid', function (d) {
                            return d.m; /* measurement id */
                        })
                        .attr('aid', function (d) {
                            return d.a; /* animal id */
                        })
                        .attr('r', size)
                        .attr('cx',
                            function (d) {
                                return d.sx;
                            })
                        .attr('cy',
                            function (d) {
                                return d.sy;
                            })
                        .classed('selected',
                            function (d) {
                                var v = false;
                                if (highlightType !== 'n')
                                    v = selectedDatapoints.contains(d.m);
                                return v;
                            })
                        .classed('highlight' + (highlightType ? '-' + highlightType : ''),
                            function (d) {
                                return isHighlightDatapoint(highlightType, d);
                            })
                        .on('click', onClick)
                        .on('mouseenter', onMouseenter)
                        .on('mousemove', onMousemove);
                    break;

                case 's': /* draw square */
                    db.enter()
                        .append('rect')
                        .attr('mg', function (d) {
                            return d.e; /* metadata group */
                        })
                        .attr('mid', function (d) {
                            return d.m; /* measurement id */
                        })
                        .attr('aid', function (d) {
                            return d.a; /* animal id */
                        })
                        .attr('width', size * 2)
                        .attr('height', size * 2)
                        .attr('x',
                            function (d) {
                                return d.sx - size + displacement;
                            })
                        .attr('y',
                            function (d) {
                                return d.sy - size;
                            })
                        .classed('selected',
                            function (d) {
                                var v = false;
                                if (highlightType !== 'n')
                                    v = selectedDatapoints.contains(d.m);
                                return v;
                            })
                        .on('click', onClick)
                        .on('mouseenter', onMouseenter)
                        .on('mousemove', onMousemove);
                    break;
            }
        }
        return;
    }

    /**
     * Returns a generic event handler that is activated when a data point
     * is clicked.
     *
     * @param {Object} viz The visualisation object.
     */
    function getDatapointOnMouseClickHandler(viz) {
        var textfield = Ext.getCmp('specimen-search-field'),
            controller = dcc.extjs.controller,
            store = controller.getProcedureSpecimensStore();
        return function (datapoint) {
            d3.event.stopPropagation();

            controller.searchForSpecimen(datapoint.a, function () {
                var record = store.findRecord('ai', datapoint.a);
                // change textfield value without event triggering
                textfield.suspendEvents();
                if (record)
                    textfield.setValue(record.get('n'));
                else
                    textfield.setValue('Specimen not found');
                // change textfield value should now trigger events
                textfield.resumeEvents();
            });

            /* we use the object associative array as a hash map */
            if (selectedDatapoints.contains(datapoint.m))
                selectedDatapoints.remove(datapoint.m);
            else
                selectedDatapoints.add(datapoint.m, {
                    m: datapoint.m,
                    a: datapoint.a,
                    x: datapoint.x,
                    y: datapoint.y
                });

            /* update selection visuals */
            var circle = d3.select(this);
            if (circle.classed('selected'))
                circle.classed('selected', false);
            else
                circle.classed('selected', true);
        };
    }

    function prepareMetadataGroups(mgs) {
        if (!mgs || mgs.length < 2)
            return {};

        var diffSet = {}, keyValues = {}, i, c, key;
        for (key in mgs[0].v) {
            keyValues[key] = {
                'c': 1, /* how many share the same key */
                'v': mgs[0].v[key] /* for value diff */
            };
        }
        for (i = 1, c = mgs.length; i < c; ++i) {
            for (key in mgs[i].v) {
                if (diffSet[key] === 1)
                    continue; /* key already marked as different */
                /* is this key appearing for the first time in this group? */
                else if (keyValues[key] === undefined)
                    diffSet[key] = 1; /* mark this key as different */
                else if (keyValues[key].v !== mgs[i].v[key])
                    diffSet[key] = 1; /* values are different */
                else
                    keyValues[key].c += 1; /* key found in metadata group */

            }
        }
        /* are any keys from the first group not in any of the others? */
        for (key in keyValues)
            if (diffSet[key] !== 1 && keyValues[key].c === 1)
                diffSet[key] = 1;
        return diffSet;
    }

    function prepareMetadataGroupInfo(data, diffSet) {
        var msg = "<table><tbody>", key;
        for (key in data)
            if (diffSet[key])
                msg += "<tr><td>" + key + "</td><td>" + data[key] + "</td></tr>";
        for (key in diffSet)
            if (data[key] === undefined)
                msg += "<tr><td>" + key + "</td><td>missing - not supplied</td></tr>";
        return msg + "</tbody></table>";
    }

    function getMetadataGroupFilter(metadataGroup, includeMatching) {
        return function (d, i) {
            return (d.e === metadataGroup && includeMatching) ||
                (d.e !== metadataGroup && !includeMatching);
        };
    }

    function setOpacityNonMetadataGroupDatapoints(viz, metadataGroup, opacity) {
        var svg = viz.state.n.v, i,
            filter = getMetadataGroupFilter(metadataGroup, false),
            isCategorical = viz.ptype.t === 'nominal',
            selectorSuffix = isCategorical ? '.categorical .datapoints rect'
            : '-datapoints ',
            selectors = [];

        if (!isCategorical) {
            /* scatter plot (wildtype is rectangle) */
            selectors.push('.wildtype' + selectorSuffix + 'rect');
            /* beeswarm plot (both mutant and wildtype are circles) */
            selectors.push('.wildtype' + selectorSuffix + 'circle');
            selectors.push('.mutant' + selectorSuffix + 'circle');
        } else
            selectors.push(selectorSuffix);

        for (i in selectors)
            svg.selectAll(selectors[i]).filter(filter)
                .attr('opacity', opacity);
    }

    function getMetadataGroupMouseOverHandler(viz, diffSet) {
        return function (metadataGroup) {
            preventEventBubbling();
            relocateInformationBox(getBoundedMouseCoordinate(viz));
            informationBox.html(prepareMetadataGroupInfo(metadataGroup.v, diffSet))
                .attr('class', 'metadata-group-info');
            setOpacityNonMetadataGroupDatapoints(viz, metadataGroup.i, 0.25);
        };
    }

    function getMetadataGroupMouseOutHandler(viz) {
        return function (metadataGroup) {
            preventEventBubbling();
            hideInformationBox();
            setOpacityNonMetadataGroupDatapoints(viz, metadataGroup.i, 1);
        };
    }

    /**
     * Returns a generic event handler that is activated when the mouse
     * moves over a data point.
     *
     * @param {Object} viz The visualisation object.
     */
    function getDatapointOnMouseMoveHandler(viz) {
        return function (datapoint) {
            d3.event.stopPropagation();
            relocateInformationBox(getBoundedMouseCoordinate(viz));
        };
    }

    /**
     * Returns a generic event handler that is activated when the mouse
     * enters a data point.
     *
     * @param {Object} viz The visualisation object.
     */
    function getDatapointOnMouseEnterHandler(viz) {
        return function (datapoint) {
            preventEventBubbling();
            highlightSpecimen(datapoint.a);
            relocateInformationBox(getBoundedMouseCoordinate(viz));

            if (typeof retrieveSpecimenDetailsRequest.abort === 'function')
                retrieveSpecimenDetailsRequest.abort();
            retrieveSpecimenDetailsRequest =
                d3.json('rest/specimens/extjs/' + datapoint.a
                    + '?u=' + dcc.roles.uid
                    + '&s=' + dcc.roles.ssid,
                    function (data) {
                        if (data.success === true) {
                            var datum = data.specimens[0],
                                iconCls = prepareSex(datum.sex) + '-'
                                + prepareZygosity(datum.homozygous);

                            informationBox
                                .html(prepareInfo(datum, datapoint, viz.ptype))
                                .attr('class', iconCls);
                        }
                    });
        };
    }

    /**
     * Returns a generic event handler that is activated when the mouse
     * enters a statistics display.
     * 
     * @param {Object} viz The visualisation object.
     * @param {String} message Message to display.
     * @param {String} type TYpe of statistics (wildtype/mutant).
     * 
     * @returns {Function} An event handler.
     */
    function getStatisticsOnMouseEnterHandler(viz, message, type) {
        return function () {
            preventEventBubbling();
            relocateInformationBox(getBoundedMouseCoordinate(viz));
            informationBox.html(message)
                .attr('class', 'infobar-stat-' + type);
        };
    }

    /**
     * Returns a generic event handler that is activated when a data point
     * that has been highlighted is clicked.
     *
     * @param {Object} viz The visualisation object.
     */
    function getHighlightedDatapointOnMouseClickHandler(viz) {
        var textfield = Ext.getCmp('specimen-search-field'),
            controller = dcc.extjs.controller,
            store = controller.getProcedureSpecimensStore();
        return function (datapoint) {
            d3.event.stopPropagation();

            /* we use the object associative array as a hash map */
            if (selectedDatapoints.contains(datapoint.m)) {
                /* if the measurement that was click on was selected, unselect
                 * all measurements that belong to that specimen. */
                d3.selectAll('.highlight-h')
                    .classed('selected', false)
                    .each(function (d) {
                        selectedDatapoints.remove(d.m);
                    });
            } else {
                /* if the measurement that was click on was not selected, select
                 * all measurements that belong to that specimen. */
                d3.selectAll('.highlight-h')
                    .classed('selected', true)
                    .each(function (d) {
                        selectedDatapoints.add(d.m, {
                            m: d.m,
                            a: d.a,
                            x: d.x,
                            y: d.y
                        });
                    });
            }

            controller.searchForSpecimen(datapoint.a, function () {
                var record = store.findRecord('ai', datapoint.a);
                // change textfield value without event triggering
                textfield.suspendEvents();
                if (record)
                    textfield.setValue(record.get('n'));
                else
                    textfield.setValue('Specimen not found');
                // change textfield value should now trigger events
                textfield.resumeEvents();
            });
        };
    }

    /**
     * Returns a generic event handler that is activated when the mouse
     * enters a data point that has been highlighted.
     *
     * @param {Object} viz The visualisation object.
     */
    function getHighlightedDatapointOnMouseEnterHandler(viz) {
        return function (datapoint) {
            preventEventBubbling();
            relocateInformationBox(getBoundedMouseCoordinate(viz));

            if (typeof retrieveSpecimenDetailsRequest.abort === 'function')
                retrieveSpecimenDetailsRequest.abort();
            retrieveSpecimenDetailsRequest =
                d3.json('rest/specimens/extjs/' + datapoint.a
                    + '?u=' + dcc.roles.uid
                    + '&s=' + dcc.roles.ssid,
                    function (data) {
                        if (data.success === true) {
                            var datum = data.specimens[0],
                                iconCls = prepareSex(datum.sex) + '-'
                                + prepareZygosity(datum.homozygous);

                            informationBox
                                .html(prepareInfo(datum, datapoint, viz.ptype))
                                .attr('class', iconCls);
                        }
                    });
        };
    }

    /**
     * Returns true if the supplied data point must be highlighted.
     * 
     * @param {String} highlightType Type of the highlighting.
     * @param {type} datapoint Data point to check.
     * @returns {Boolean} True if the data point should be highlighted.
     */
    function isHighlightDatapoint(highlightType, datapoint) {
        var v = false;
        if (highlightType) {
            switch (highlightType) {
                case 'h':
                    if (datapoint.a === highlightedSpecimen)
                        v = true;
                    break;
                case 'n':
                    if (dcc.lastQcDone !== undefined
                        && datapoint.fd > dcc.lastQcDone)
                        v = true;
                    break;
            }
        }
        return v;
    }

    /**
     * Renders a swarm plot with the supplied data points.
     *
     * @param {Object} dataset Set of data points to plot.
     * @param {Object} svg SVG container.
     * @param {String} cls Swarm class to group data points.
     * @param {Real} radius Radius of each data point.
     * @param {Function} onClick Data point on mouse click handler.
     * @param {Function} onMouseenter Data point on mouse enter handler.
     * @param {Function} onMousemove Data point on mouse move handler.
     * @param {Character} highlightType What to highlight.
     */
    function plotSwarm(dataset, svg, cls, radius, onClick,
        onMouseenter, onMousemove, highlightType) {
        cls = 'swarm-' + cls;
        svg.select('.' + cls).remove();
        svg.append('g').attr('class', cls)
            .selectAll('circle')
            .data(dataset).enter()
            .append('circle')
            .attr('class',
                function (d) {
                    return d.s === 1 ? 'male' : 'female';
                })
            .attr('mg',
                function (d) {
                    return d.e; /* metadata group */
                })
            .attr('mid',
                function (d) {
                    return d.m; /* measurement id */
                })
            .attr('aid',
                function (d) {
                    return d.a; /* animal id */
                })
            .attr('r', radius)
            .attr('cx',
                function (d) {
                    return d.sx;
                })
            .attr('cy',
                function (d) {
                    return d.sy;
                })
            .on('click', onClick)
            .on('mouseenter', onMouseenter)
            .on('mousemove', onMousemove)
            .classed('selected',
                function (d) {
                    var v = false;
                    if (highlightType !== 'n')
                        v = selectedDatapoints.contains(d.m);
                    return v;
                })
            .classed('highlight' + (highlightType ? '-' + highlightType : ''),
                function (d) {
                    return isHighlightDatapoint(highlightType, d);
                });
    }

    function getDatapointHighlightType(viz) {
        return viz.isActiveCtrl('newdata') ? 'n'
            : (viz.isActiveCtrl('highlight') ? 'h' : null);
    }

    /**
     * Show data point swarm.
     *
     * @param {Object} viz Parent visualisation.
     * @param {Object} datapoints Datapoints on the same x-axis.
     * @param {String} cls Class for swarm group.
     * @param {Real} femaleAxis x-axis value for female vertical swarm axis.
     * @param {Real} maleAxis x-axis value for male vertical swarm axis.
     * @param {Real} radius Radius of a datapoint circle.
     * @param {Boolean} clickable Is the datapoint clickable.
     */
    function showDatapointSwarm(viz, datapoints, cls,
        femaleAxis, maleAxis, radius, clickable) {
        var g, i, l, maleData = [], femaleData = [], datapoint, swarm,
            xScale = viz.scale.x, yScale = viz.scale.y,
            showMale = viz.isActiveCtrl('male'),
            showFemale = viz.isActiveCtrl('female'),
            onClick = clickable ? getDatapointOnMouseClickHandler(viz) : null,
            onMouseenter = getDatapointOnMouseEnterHandler(viz),
            onMousemove = getDatapointOnMouseMoveHandler(viz),
            highlightType = getDatapointHighlightType(viz);

        if (viz.isActiveCtrl('point')) {
            g = viz.state.n.v.append('g').attr('class', cls);
            for (i = 0, l = datapoints.length; i < l; ++i) {
                datapoint = datapoints[i].d[0];
                datapoint.sy = yScale(datapoint.y);
                if (isMaleDatapoint(datapoint)) {
                    if (showMale)
                        maleData.push(datapoint);
                    else
                        continue;
                } else {
                    if (showFemale)
                        femaleData.push(datapoint);
                    else
                        continue;
                }
            }

            swarm = new Beeswarm(maleData, xScale(maleAxis), radius);
            plotSwarm(swarm.swarm(0, SWARM_BOUND), g, 'male', radius, onClick,
                onMouseenter, onMousemove, highlightType);
            swarm = new Beeswarm(femaleData, xScale(femaleAxis), radius);
            plotSwarm(swarm.swarm(0, SWARM_BOUND), g, 'female', radius, onClick,
                onMouseenter, onMousemove, highlightType);
        }
    }

    /**
     * Each visuslisation container stores a visibility flag. The following
     * method refreshes visualisations that are visible by re-rendering the
     * visualisation.
     */
    function refreshVisibleVisualisations() {
        var viz = dcc.viz;
        if (viz.container.isVisible)
            viz.refresh();
    }

    /**
     * Highlights a specimen in all of the visualisations.
     *
     * @param {type} animalId Specimen/animal identifier.
     */
    function highlightSpecimen(animalId) {
        if (highlightedSpecimen === animalId)
            return;
        else
            highlightedSpecimen = animalId;
        var viz = dcc.viz;
        if (viz.container.isVisible)
            viz.highlight();
    }

    /**
     * Prepare effective x-scale for use in plotting.
     *
     * NOTE:
     * If all datapoints have the same x-value, artificially expand the
     * scale so that the data points are in the middle. Note that we need
     * four columns for female, female(WT), male and male(WT).
     *
     * @param {String} type Data type of the x-values.
     * @param {Object} minX Minimum x-value for the data set.
     * @param {Object} maxX Maximum x-value for the data set.
     * @param {Integer} width Width of the visualisation (in pixels).
     * @param {Integer} padding Padding around plottable region (in pixels).
     */
    function prepareEffectiveXscale(type, minX, maxX, width, padding) {
        if (type === 'd') {
            if (minX.getTime() === maxX.getTime()) {
                minX = addDaysToDate(minX, -2); /* go back two days */
                maxX = addDaysToDate(maxX, 2); /* go forward two days */
            }
            return getTemporalScaler(minX, maxX, padding, width - padding);
        } else {
            if (minX === maxX) {
                minX -= 2;
                maxX += 2;
            }
            return getLinearScaler(minX, maxX, padding, width - padding);
        }
    }

    function prepareEffectiveYscale(minY, maxY, height, padding) {
        if (minY === maxY) {
            minY -= 2;
            maxY += 2;
        }
        return getLinearScaler(minY, maxY, height - padding, padding);
    }

    /**
     * Creates a series plot.
     *
     * @param {Object} viz The visualisation object.
     */
    function seriesPlot(viz) {
        var containerDomNode = viz.state.n.v, ptype = viz.ptype,
            visualisationDimension = viz.chart.dim, padding = viz.dim.p,
            width = visualisationDimension.w, height = visualisationDimension.h,
            mt = viz.state.mutantStatistics.genderCombined.overall,
            minX = mt.x.min,
            minY = mt.y.min,
            maxX = mt.x.max,
            maxY = mt.y.max,
            wt = viz.state.wildtypeStatistics;

        /* if wild type is to be displayed, and if the statistics are defined */
        if (viz.isActiveCtrl('wildtype')) {
            wt =
                getOverallBaselineStatisticsBothGenders(wt, viz.gid);
            if (wt) {
                if (minX > wt.x.min)
                    minX = wt.x.min;
                if (minY > wt.y.min)
                    minY = wt.y.min;
                if (maxX < wt.x.max)
                    maxX = wt.x.max;
                if (maxY < wt.y.max)
                    maxY = wt.y.max;
            }
        }

        /* include min and max value range if they are to be displayed */
        if (viz.isActiveCtrl('minmax') && ptype.validQcBounds) {
            if (minY > ptype.qMin)
                minY = ptype.qMin;
            if (ptype.qMax > maxY)
                maxY = ptype.qMax;
        }

        /* create the scales for converting data point values to the SVG screen
         * coordinates, and vice versa. */
        viz.scale.x = prepareEffectiveXscale(viz.ptype.xt,
            minX, maxX, width, padding);
        viz.scale.y = prepareEffectiveYscale(minY, maxY, height, padding);

        /* create brush for implementing box selector */
        viz.state.n.b = d3.svg.brush();

        /* remove default box selector (for making data point selections) if
         * visualisation is currently highlighting selected data points;
         * otherwise, activate default box selector */
        if (viz.isActiveCtrl('selected'))
            containerDomNode.selectAll('.box-selector').remove();
        else
            attachBoxSelector(viz, 'select');

        viz.minmax(); /* show min/max value range */

        /* visualise statistics */
        containerDomNode.selectAll('.ebar').remove();
        containerDomNode.selectAll('.stat').remove();
        viz.state.n.s = containerDomNode.append('g').attr('class', 'stat');
        viz.whisker();
        if (viz.isActiveCtrl('statistics')) {
            viz.stat('mean');
            viz.stat('median');
            viz.stat('max');
            viz.stat('min');
            viz.quartiles();
            viz.overallstat();
        }

        containerDomNode.selectAll('.mutant-datapoints').remove();
        containerDomNode.selectAll('.wildtype-datapoints').remove();
        viz.showDataPoints();

        if (viz.isActiveCtrl('shapes') && viz.type !== 'series')
            viz.legendsShapes();
        else
            viz.legends();

        viz.selected(MUTANT_DATAPOINT_RADIUS);
        viz.title();
        viz.xaxis();
        viz.yaxis();
        viz.crosshair();
        svgMouseventHandler(viz);
    }

    /**
     * Displays segment information when mouse if over a segment.
     *
     * @param {Object} viz The visualisation object.
     * @param {Object} data Contains category, percentage and labels.
     * @param {String} gender Gender information.
     */
    function onSegmentMouseOver(viz, data, gender) {
        gender = gender.toLowerCase();
        if (gender === 'no data' || gender === 'n')
            gender = '(gender - no data)';
        if (gender === 'm')
            gender = 'male';
        if (gender === 'f')
            gender = 'female';
        if (gender === 'i')
            gender = 'intersex';
        gender = ' ' + gender;
        var suffix = data.l + gender +
            ' specimens belong to the <b>' + data.c + '</b> category';
        d3.event.stopPropagation();
        relocateInformationBox(getBoundedMouseCoordinate(viz));
        informationBox.html('<b>' + data.p.toFixed(2) + '%</b> of ' + suffix +
            ', or<br><br><b>' + Math.round(data.p * data.t * 0.01) +
            '</b> out of <b>' + data.t + '</b> of ' + suffix)
            .attr('class', '');
    }

    /**
     * Follow the mouse when moving over a segment.
     * @param {Object} viz The visualisation object.
     */
    function onSegmentMouseMove(viz) {
        d3.event.stopPropagation();
        relocateInformationBox(getBoundedMouseCoordinate(viz));
    }

    /**
     * Convert category percentages to segmented column specifications.
     *
     * @param {Real} datum Object with array of category percentages.
     * @param {Object} spec Specification of the segmented column container.
     * @returns {Object} Array of segmented column specifications.
     */
    function convertPercentagesToSegmentSpec(datum, spec) {
        var percentage, percentages = datum.s, category, segments = [],
            height = spec.ch * 0.01; /* converts percentage to height */

        for (category in percentages) {
            percentage = percentages[category];
            segments.push({
                'c': category,
                'p': percentage,
                'h': percentage * height,
                'y': 0,
                's': categoryColourIndex[category],
                'l': spec.l, /* grid label for segment detail */
                't': datum.t, /* total number of specimens */
                'g': datum.s
            });
        }
        return segments;
    }

    /**
     * Display total count and gender on top of segmented columns.
     *
     * @param {Object} svg SVG node to attach label to.
     * @param {Integer} x x-coordinate of the middle of the column.
     * @param {Integer} y y-coordinate of the top of the column.
     * @param {Integer} count Number of specimens.
     * @param {String} label Label to diplay below the count.
     */
    function showSegmentedColumnTotalAndGender(svg, x, y, count, label) {
        text(svg, x, y - 4, count, 'segment-column-label');
        text(svg, x, y + 9, label, 'segment-column-label');
    }

    /**
     * Plots a segmented column with the supplied percentages.
     *
     * @param {Object} viz Visualisation object.
     * @param {Boolean} gender String for gender.
     * @param {Object} datum Category frequency total and percentages.
     * @param {Integer} x x-coordinate of segmented column bottom-left.
     * @param {Integer} y y-coordinate of segmented column bottom-left.
     * @param {Object} spec Specification for plotting each grid cell.
     */
    function plotSegmentColumn(viz, gender, datum, x, y, spec) {
        var svg = viz.state.n.s, i, c, db, width = spec.cw,
            segments = convertPercentagesToSegmentSpec(datum, spec, isMale);

        c = segments.length;
        if (c > 0) {
            /* sort the data by category */
            segments.sort(getComparator('c'));

            /* set segment height and y-coordinate of top-left corner */
            segments[0].y = y - segments[0].h;
            for (i = 1, c = segments.length; i < c; ++i)
                segments[i].y = segments[i - 1].y - segments[i].h;

            showSegmentedColumnTotalAndGender(svg,
                x + 0.5 * width,
                segments[c - 1].y - .5 * spec.tp,
                datum.t, gender);
        }

        /* plot a segment for each category percentage */
        svg = svg.append('g').attr('class', 'category-grid');
        db = svg.selectAll('rect').data(segments);
        db.exit().remove();
        db.enter().append('rect')
            .attr('x', x)
            .attr('y', function (d) {
                return d.y;
            })
            .attr('width', width)
            .attr('height', function (d) {
                return d.h;
            })
            .attr('class', function (d) {
                return 'segment-' + d.s;
            })
            .on('mouseover', function (d) {
                onSegmentMouseOver(viz, d, gender);
            })
            .on('mousemove', function (d) {
                onSegmentMouseMove(viz);
            })
            .on('mouseout', function (d) {
                informationBox.style('display', 'none');
            });
    }
    /**
     * Creates a swarm plot of scatter data.
     *
     * @param {Object} viz The visualisation object.
     */
    function swarmPlot(viz) {
        var containerDomNode = viz.state.n.v,
            visualisationDimension = viz.chart.dim, padding = viz.dim.p,
            width = visualisationDimension.w, height = visualisationDimension.h,
            mt = viz.state.mutantStatistics.genderCombined.overall,
            minX = mt.x.min,
            minY = mt.y.min,
            maxX = mt.x.max,
            maxY = mt.y.max,
            wt = viz.state.wildtypeStatistics;

        /* if the wild type statistics is defined, fix x and y scales */
        wt = getOverallBaselineStatisticsBothGenders(wt);
        if (wt !== undefined) {
            /* if wild type should be displayed, adjust y-axis */
            if (viz.isActiveCtrl('wildtype')) {
                if (minY > wt.y.min)
                    minY = wt.y.min;
                if (maxY < wt.y.max)
                    maxY = wt.y.max;
            }
            /* keep the x-axis as it is: don't exclude wildtype */
            if (minX > wt.x.min)
                minX = wt.x.min;
            if (maxX < wt.x.max)
                maxX = wt.x.max;
        }

        /* create the scales for converting data point values to the SVG screen
         * coordinates, and vice versa. */
        viz.scale.x = prepareEffectiveXscale(viz.ptype.xt,
            minX, maxX, width, padding);
        viz.scale.y = prepareEffectiveYscale(minY, maxY, height, padding);

        /* create brush for implementing box selector */
        viz.state.n.b = d3.svg.brush();

        /* remove default box selector (for making data point selections) if
         * visualisation is currently highlighting selected data points;
         * otherwise, activate default box selector */
        if (viz.isActiveCtrl('selected'))
            containerDomNode.selectAll('.box-selector').remove();
        else
            attachBoxSelector(viz, 'select');

        viz.minmax(); /* show min/max value range */

        /* render the statistics first; but remove existing DOM nodes that are
         * related to statistics visuals */
        containerDomNode.selectAll('.ebar').remove();
        containerDomNode.selectAll('.stat').remove();
        var xScale = viz.scale.x, range = xScale.range(),
            swarmWidth = (range[1] - range[0]) / 16,
            scaledMutantFemaleAxis = swarmWidth + range[0],
            scaledWildtypeFemaleAxis = swarmWidth * 4 + range[0],
            scaledMutantMaleAxis = swarmWidth * 8 + range[0],
            scaledWildtypeMaleAxis = swarmWidth * 12 + range[0],
            mutantFemaleAxis = xScale.invert(scaledMutantFemaleAxis),
            wildtypeFemaleAxis = xScale.invert(scaledWildtypeFemaleAxis),
            mutantMaleAxis = xScale.invert(scaledMutantMaleAxis),
            wildtypeMaleAxis = xScale.invert(scaledWildtypeMaleAxis),
            swarmLabelY = height - .75 * padding,
            isWildtype = viz.gid === 0;

        viz.state.n.s = containerDomNode.append('g').attr('class', 'stat');

        if (viz.isActiveCtrl('female') && viz.state.mutantStatistics.female)
            text(viz.state.n.s, scaledMutantFemaleAxis,
                swarmLabelY, 'Female', 'swarm-label');
        if (!isWildtype && viz.isActiveCtrl('wildtype') &&
            viz.isActiveCtrl('female') &&
            viz.state.wildtypeStatistics.female &&
            viz.state.wildtypeStatistics.female.overall)
            text(viz.state.n.s, scaledWildtypeFemaleAxis,
                swarmLabelY, 'Female (WT)', 'swarm-label');
        if (viz.isActiveCtrl('male') && viz.state.mutantStatistics.male)
            text(viz.state.n.s, scaledMutantMaleAxis,
                swarmLabelY, 'Male', 'swarm-label');
        if (!isWildtype && viz.isActiveCtrl('wildtype') &&
            viz.isActiveCtrl('male') &&
            viz.state.wildtypeStatistics.male &&
            viz.state.wildtypeStatistics.male.overall)
            text(viz.state.n.s, scaledWildtypeMaleAxis,
                swarmLabelY, 'Male (WT)', 'swarm-label');

        if (viz.isActiveCtrl('whisker')) {
            if (viz.isActiveCtrl('female')) {
                if (viz.state.mutantStatistics.female
                    && viz.state.mutantStatistics.female.overall)
                    plotBoxAndWhisker('mutant-female-swarm', viz,
                        viz.state.mutantStatistics.female.overall.y,
                        mutantFemaleAxis, 0, 60,
                        isWildtype ? 'wildtype' : 'mutant');

                if (!isWildtype && viz.isActiveCtrl('wildtype') &&
                    viz.state.wildtypeStatistics.female &&
                    viz.state.wildtypeStatistics.female.overall)
                    plotBoxAndWhisker('wildtype-female-swarm', viz,
                        viz.state.wildtypeStatistics.female.overall.y,
                        wildtypeFemaleAxis, 0, 60, 'wildtype');
            }
            if (viz.isActiveCtrl('male')) {
                if (viz.state.mutantStatistics.male
                    && viz.state.mutantStatistics.male.overall)
                    plotBoxAndWhisker('mutant-male-swarm', viz,
                        viz.state.mutantStatistics.male.overall.y,
                        mutantMaleAxis, 0, 60,
                        isWildtype ? 'wildtype' : 'mutant');

                if (!isWildtype && viz.isActiveCtrl('wildtype') &&
                    viz.state.wildtypeStatistics.male &&
                    viz.state.wildtypeStatistics.male.overall)
                    plotBoxAndWhisker('wildtype-male-swarm', viz,
                        viz.state.wildtypeStatistics.male.overall.y,
                        wildtypeMaleAxis, 0, 60, 'wildtype');
            }
        }

        if (viz.isActiveCtrl('statistics')) {
            viz.overallstat();
        }

        /* show all of the wild type data points */
        containerDomNode.selectAll('.wildtype-datapoints').remove();
        if (!isWildtype && viz.isActiveCtrl('wildtype'))
            viz.showBaselineDatapointSwarm(wildtypeFemaleAxis, wildtypeMaleAxis);

        /* show all of the mutant data points */
        containerDomNode.selectAll('.mutant-datapoints').remove();
        viz.showMutantDatapointSwarm(mutantFemaleAxis, mutantMaleAxis);

        viz.legends();
        viz.selected(MUTANT_DATAPOINT_RADIUS);
        viz.title();
        viz.yaxis();
        viz.crosshair();
        svgMouseventHandler(viz);
    }

    /**
     * Calculates specification for plotting a grid column.
     *
     * @param {Integer} width Width of a grid cell.
     * @param {Integer} height Height of a grid cell.
     *
     * @returns {Object} Specification for plotting each grid cell.
     */
    function calculateColumnPlotSpecification(width, height) {
        var dx = width * 0.1,
            horizontalCellMiddle = width * 0.5,
            barX = dx * 0.5,
            barWidth = width - 2 * dx,
            barMiddle = horizontalCellMiddle * 0.5,
            bottomPadding = 25,
            topPadding = 40,
            barY = height - bottomPadding,
            columnHeight = height - bottomPadding - topPadding;
        return {
            'dx': dx,
            'cm': horizontalCellMiddle,
            'cw': barWidth,
            'ch': columnHeight,
            'tp': topPadding,
            'bp': bottomPadding,
            'bx': barX,
            'by': barY,
            'bw': barWidth,
            'bm': barMiddle
        };
    }

    /**
     * Plots two segmented bar charts, one for male and the other for female.
     *
     * @param {Object} viz Visualisation object.
     * @param {Object} femaleFreq Category frequency and percentages of female.
     * @param {Object} maleFreq Category frequency and percentages of male.
     * @param {Object} intersexFreq Category frequency and percentages of intersex.
     * @param {Object} nogenderFreq Category frequency and percentages of no gender.
     * @param {Integer} x x-coordinate of cell visualisation top-left.
     * @param {Integer} y y-coordinate of cell visualisation top-left.
     * @param {Object} spec Specification for plotting each grid cell.
     * @param {String} label Grid cell label.
     */
    function plotFrequencyColumnCell(viz, femaleFreq, maleFreq, intersexFreq,
        nogenderFreq, x, y, spec, label) {
        var svg = viz.state.n.s, numColumns = 0,
            tx = x + spec.dx, ty = y + spec.by, abbreviate = false;

        /* horizontal reference bar from which the segments are grown */
        line(svg, tx, ty, tx + spec.bw, ty, 'grid-bar');

        /* grid cell label */
        text(svg, x + spec.cm, ty + 15, label, 'category-grid-label');

        /* pass the grid label for segment detail */
        spec.l = label.toLowerCase();

        if (femaleFreq.t > 0) {
            ++numColumns;
        }
        if (maleFreq.t > 0) {
            ++numColumns;
        }
        if (intersexFreq.t > 0) {
            ++numColumns;
        }
        if (nogenderFreq.t > 0) {
            ++numColumns;
        }

        spec.cw = (spec.bw - (numColumns - 1) * spec.dx) / numColumns;
        if (spec.cw < 37)
            abbreviate = true;

        if (femaleFreq.t > 0) {
            /* plot female segmented column */
            plotSegmentColumn(viz, abbreviate ? 'F' : 'Female', femaleFreq, tx, ty, spec);
            tx += spec.cw + spec.dx;
        }
        if (maleFreq.t > 0) {
            /* plot male segmented column */
            plotSegmentColumn(viz, abbreviate ? 'M' : 'Male', maleFreq, tx, ty, spec);
            tx += spec.cw + spec.dx;
        }
        if (intersexFreq.t > 0) {
            /* plot intersex segmented column */
            plotSegmentColumn(viz, abbreviate ? 'I' : 'Intersex', intersexFreq, tx, ty, spec);
            tx += spec.cw + spec.dx;
        }
        if (nogenderFreq.t > 0) {
            /* plot no data segmented column */
            plotSegmentColumn(viz, abbreviate ? 'N' : 'No data', nogenderFreq, tx, ty, spec);
        }
    }

    /**
     * Plots the two-dimensional array of frequency columns.
     *
     * @param {Object} viz Visualisation object.
     * @param {Object} freqGrid Frequency grid with category frequencies.
     * @param {Integer} x x-coordinate of grid top-left.
     * @param {Integer} y y-coordinate of grid top-left.
     * @param {Integer} width Width of a grid cell.
     * @param {Integer} height Height of a grid cell.
     */
    function plotFrequencyColumns(viz, freqGrid, x, y, width, height) {
        var spec = calculateColumnPlotSpecification(width, height),
            svg = viz.state.n.s,
            separatorY = y + height * 0.5;

        rect(svg, x, y, 4 * width,
            height, 'mutant-categorical-split');

        /*
         *                  Het    Hom     Hem    All
         *        Female  (0, 0)  (0, 1)  (0,2)  (0, 3)
         *          Male  (1, 0)  (1, 1)  (1,2)  (1, 3)
         *      Intersex  (2, 0)  (2, 1)  (2,2)  (2, 3)
         *       No data  (3, 0)  (3, 1)  (3,2)  (3, 3)
         *           All  (4, 0)  (4, 1)  (4,2)  (4, 3)
         */

        /* plot heterozygous */
        plotFrequencyColumnCell(viz,
            freqGrid[0][0].mutantStatistics, /* mutant heterozygous female */
            freqGrid[1][0].mutantStatistics, /* mutant heterozygous male */
            freqGrid[2][0].mutantStatistics, /* mutant heterozygous intersex */
            freqGrid[3][0].mutantStatistics, /* mutant heterozygous no data */
            x, y, spec, 'Het', false);

        /* plot homozygous */
        x += width;
        text(svg, x, separatorY, '+', 'segmented-separator');
        plotFrequencyColumnCell(viz,
            freqGrid[0][1].mutantStatistics, /* mutant homozygous female */
            freqGrid[1][1].mutantStatistics, /* mutant homozygous male */
            freqGrid[2][1].mutantStatistics, /* mutant homozygous intersex */
            freqGrid[3][1].mutantStatistics, /* mutant homozygous no data */
            x, y, spec, 'Hom', false);

        /* plot hemizygous */
        x += width;
        text(svg, x, separatorY, '+', 'segmented-separator');
        plotFrequencyColumnCell(viz,
            freqGrid[0][2].mutantStatistics, /* mutant hemizygous female */
            freqGrid[1][2].mutantStatistics, /* mutant hemizygous male */
            freqGrid[2][2].mutantStatistics, /* mutant hemizygous intersex */
            freqGrid[3][2].mutantStatistics, /* mutant hemizygous no data */
            x, y, spec, 'Hem', false);

        /* plot all zygosities */
        x += width;
        text(svg, x, separatorY, '=', 'segmented-separator');
        plotFrequencyColumnCell(viz,
            freqGrid[0][3].mutantStatistics, /* mutant female */
            freqGrid[1][3].mutantStatistics, /* mutant male */
            freqGrid[2][3].mutantStatistics, /* mutant intersex */
            freqGrid[3][3].mutantStatistics, /* mutant no data */
            x, y, spec, 'Mutant', false);

        /* plot wild type */
        x += width;
        plotFrequencyColumnCell(viz,
            freqGrid[0][3].wildtypeStatistics, /* wild type female */
            freqGrid[1][3].wildtypeStatistics, /* wild type male */
            freqGrid[2][3].wildtypeStatistics, /* wild type intersex */
            freqGrid[3][3].wildtypeStatistics, /* wild type no data */
            x, y, spec, 'Wildtype', true);
    }

    /**
     * Calculates the number of rows and columns for a two-dimensional
     * grid that can hold the supplied number of data points.
     *
     * @param {Integer} n Number of data points to fit.
     * @param {Integer} width Width of the rectangular area to fill.
     * @param {Integer} height Height of the rectangular area to fill.
     *
     * @returns {Object} Number of rows, columns, and cell width and height.
     */
    function calculateDatapointGridDimension(n, width, height) {
        /* our aim is to fit all of the data points inside the last column
         * of the visualisation grid. But first, we must calculate the
         * aspect ratio of this visualisation area.
         *
         *     aspect_ratio = width / height
         *
         * if c denotes the number of data points per row, we must have
         *
         *    c * (c / aspect_ratio) >= number_of_data_points
         *
         * or, c >= sqrt(number_of_data_points * aspect_ratio)
         */
        var c = Math.ceil(Math.sqrt((n * width) / height)),
            r = Math.ceil(n / c);

        /* width and height for each data point */
        return {
            'r': r,
            'c': c,
            'w': Math.floor(width / c),
            'h': Math.floor(height / r)
        };
    }

    /**
     * Plots categorical option values for all of the data points.
     *
     * @param {Object} viz Visualisation object
     * @param {Array} data Data set to plot.
     * @param {Integer} x x-coordinate of cell visualisation top-left.
     * @param {Integer} y y-coordinate of cell visualisation top-left.
     * @param {Integer} width Width of the rectangular area.
     * @param {Integer} height Height of the rectangular area.
     * @param {Function} onClick Event handler for events
     *     when mouse is clicked on a data point.
     * @param {Function} onMouseEnter Event handler when pointer enter cell.
     * @param {Function} onMouseMove Event handler when pointer moves over cell.
     */
    function plotCategoricalDatapoints(viz, data, x, y, width, height,
        onClick, onMouseEnter, onMouseMove) {
        var svg = viz.state.n.s, k = 0, tx, ty,
            n = data.length, dataPoint, dataPointArray = [],
            dim = calculateDatapointGridDimension(n, width, height),
            c = dim.c, w = dim.w, h = dim.h, xHigh = x + (c - 1) * w,
            highlightType = getDatapointHighlightType(viz);
        tx = x;
        ty = y;
        while (k < n) {
            dataPoint = data[k++];
            dataPointArray.push({
                'e': dataPoint.e, /* metadata group */
                'm': dataPoint.m, /* the measurement id */
                'a': dataPoint.a, /* animal id */
                'n': dataPoint.n, /* animal name */
                'x': tx,
                'y': ty,
                'w': w, /* width */
                'h': h, /* height */
                'v': dataPoint.v /* category value */
            });

            tx += w;
            if (tx > xHigh) {
                ty += h; /* next row */
                tx = x;
            }
        }

        svg.selectAll('.datapoints').remove();
        svg = svg.append('g').attr('class', 'datapoints');
        var db = svg.selectAll('rect').data(dataPointArray);
        db.exit().remove();
        db.enter().append('rect')
            .attr('x',
                function (d) {
                    return d.x;
                })
            .attr('y',
                function (d) {
                    return d.y;
                })
            .attr('width',
                function (d) {
                    return d.w;
                })
            .attr('height',
                function (d) {
                    return d.h;
                })
            .attr('mg', function (d) {
                return d.e; /* metadata group */
            })
            .attr('mid',
                function (d) {
                    return d.m; /* measurement id */
                })
            .attr('aid',
                function (d) {
                    return d.a; /* animal id */
                })
            .attr('class',
                function (d) {
                    return 'segment-' + categoryColourIndex[d.v];
                })
            .classed('selected',
                function (d) {
                    var v = false;
                    if (highlightType !== 'n')
                        v = selectedDatapoints.contains(d.m);
                    return v;
                })
            .classed('highlight' + (highlightType ? '-' + highlightType : ''),
                function (d) {
                    return isHighlightDatapoint(highlightType, d);
                })
            .on('click', onClick)
            .on('mouseenter', onMouseEnter)
            .on('mousemove', onMouseMove);

        /* display data point label */
        if (data[0])
            text(svg, x + width * 0.5, y - 10,
                (data[0].g === 0 ? 'Baseline' : 'Mutant') + ' data points grid',
                'categorical-datapoints');
    }

    /**
     * Display all of the legends.
     *
     * @param {Object} viz Visualisation object.
     * @param {Integer} x x-coordinate of legend top-left.
     * @param {Integer} y y-coordinate of legend top-left.
     * @param {Array} categories List of categories to display.
     */
    function displayCategoryLegends(viz, x, y, categories) {
        var svg = viz.state.n.s, label, count, category,
            legendsPerColumn = 5, ty = y, boxSize = 10, i, c;
        count = legendsPerColumn;
        for (i = 0, c = categories.length; i < c; ++i) {
            category = categories[i];
            rect(svg, x, ty, boxSize, boxSize,
                'segment-' + categoryColourIndex[category]);
            label = category.icap();
            if (label.length > 24)
                label = label.substr(0, 24) + '...';
            text(svg, x + 2 * boxSize, ty + boxSize, label, 'segment-label');

            ty += boxSize * 2;
            if (--count === 0) {
                x += 180;
                ty = y;
                count = legendsPerColumn;
            }
        }
    }

    /**
     * Plots categorical data. The data itself is retrieved from the
     * cached measurements.
     *
     * @param {type} viz The visualisation object.
     */
    function categoricalPlot(viz) {
        var containerDomNode = viz.state.n.v, state = viz.state,
            statistics = state.mutantStatistics,
            mutantData = state.mutantDataset,
            svg = state.n.v, vizDim = viz.chart.dim,
            padding = viz.dim.p, halfPadding = 0.5 * padding,
            width = vizDim.w - padding,
            height = vizDim.h - 2.3 * padding,
            /* divide the visualisation chart area into a 3x5 grid
             * 5th column cells are merged to display specific data point. the
             * rest of the grids display nine visualisations for each of the
             * following combinations:
             *
             *                  Het    Hom     Hem    All
             *        Female  (0, 0)  (0, 1)  (0,2)  (0, 3)
             *          Male  (1, 0)  (1, 1)  (1,2)  (1, 3)
             *      Intersex  (2, 0)  (2, 1)  (2,2)  (2, 3)
             *       No data  (3, 0)  (3, 1)  (3,2)  (3, 3)
             *           All  (4, 0)  (4, 1)  (4,2)  (4, 3)
             */
            cellWidth = Math.floor(width / 6);

        /* used for on mouse over events for data points */
        viz.scale.x = getLinearScaler(0, vizDim.w, 0, vizDim.w);
        viz.scale.y = getLinearScaler(0, vizDim.h, vizDim.h, 0);

        /* root SVG node for plotting */
        containerDomNode.selectAll('.categorical').remove();
        viz.state.n.s = svg = svg.append('g').attr('class', 'categorical');

        plotFrequencyColumns(viz, statistics.freqGrid,
            padding * 0.25, 1.75 * padding, cellWidth, height);

        plotCategoricalDatapoints(viz, mutantData,
            halfPadding + 5 * cellWidth, 2 * padding,
            cellWidth, height,
            getDatapointOnMouseClickHandler(viz),
            getDatapointOnMouseEnterHandler(viz),
            getDatapointOnMouseMoveHandler(viz));

        displayCategoryLegends(viz, halfPadding, halfPadding,
            statistics.categories);
        viz.title(); /* show title of the visualisation */
        svgMouseventHandler(viz);
    }

    /**
     * Returns a plotting type for a parameter object.
     *
     * <p>The parameters web service returns a JSON string that contains an
     * array of parameter objects for the supplied procedure. Each of these
     * JSON objects have some of the following attributes:</p>
     *
     * <ul>
     * <li>p: procedure id</li>
     * <li>i: parameter id</li>
     * <li>e: parameter stable identifier</li>
     * <li>n: parameter name</li>
     * <li>s: sequence number in the list of parameters</li>
     * <li>d: datatype of the measured value</li>
     * <li>u: measurement unit</li>
     * <li>ii: increment identifier</li>
     * <li>im: increment minimum</li>
     * <li>it: increment type</li>
     * <li>iu: increment unit</li>
     * <li>iv: increment value</li>
     * </ul>
     *
     * <p>The returned object has the following attributes:</p>
     *
     * <ul>
     * <li>t: type of the graph/plot to use. The types are given below</li>
     * <li>xc: string-to-value convertor function to use on x-axis</li>
     * <li>yc: string-to-value convertor function to use on y-axis</li>
     * <li>xl: label for the x-axis</li>
     * <li>xt: type of x-axis value</li>
     * <li>yl: label for the y-axis</li>
     * <li>l: chart title</li>
     * </ul>
     *
     * <p>The recognised string codes for graph/plot types are:</p>
     *
     * <ul>
     * <li>noplot: Do not plot (unplottable data)</li>
     * <li>point: Single point plot</li>
     * <li>series: Series plot (points and lines)</li>
     * <li>scatter: Scattor plot.</li>
     * </ul>
     *
     * @param {Object} parameter Parameter object.
     *
     * @return The plotting type that is appropriate for the parameter.
     */
    dcc.determinePlotType = function (parameter) {
        var plotType = {}, options, j, k;
        if (!parameter)
            plotType = null; /* invalid parameter */
        else {
            categoryColourIndex = {
                'Highlighted specimen': 0,
                'Selected specimen': 1
            };
            /* prepare category colour index */
            options = parameter.o;
            if (options && options.length > 0) {
                options.sort(function (a, b) {
                    return a.localeCompare(b);
                });
                for (j = 0, k = options.length; j < k; ++j) {
                    categoryColourIndex[options[j]] = j + 2;
                }
            }

            if (parameter.d === null || parameter.d === undefined) {
                /* don't plot: no data type available for conversion */
                plotType.t = 'noplot';
            } else {
                plotType.l = parameter.a; /* procedure name */

                /* some strings values in the database are not trimmed */
                parameter.d = parameter.d.trim(); /* data Ftype */

                if (parameter.d === 'TEXT') {
                    switch (parameter.t) {
                        case 0:
                            plotType.t = 'meta';
                            break;
                        case 3: /* categorical data set */
                            plotType.t = 'nominal';
                            plotType.yl = parameter.n.icap();
                            break;
                    }
                } else {
                    /* unit of measurement */
                    parameter.u = parameter.u ? parameter.u.trim() : null;

                    if (parameter.d.length === 0 ||
                        'NULL' === parameter.d) {
                        if (parameter.u === null || parameter.u.length === 0) {
                            /* don't plot: no data type or unit */
                            plotType.t = 'noplot';
                        } else {
                            /* assume float if unit is specified */
                            parameter.d = 'float';
                            plotType = getLabelsAndConvertors(parameter);
                        }
                    } else
                        plotType = getLabelsAndConvertors(parameter);
                }
            }

            if (parameter.d === 'IMAGE') {
                plotType.t = 'image';
            }
        }
        return plotType;
    };

    /**
     * Determine plot type, axis labels and data convertors.
     *
     * @param parameter Parameter object.
     * @return The plot type, data convertors and axis labels.
     */
    function getLabelsAndConvertors(parameter) {
        /* initialise with convertor function for measurement values
         * and the parameter name */
        var plotType = {
            yt: getYValueType(parameter.d),
            yc: getDataConvertor(parameter.d),
            yl: parameter.n,
            l: parameter.a /* procedure name */
        };

        /* prepare y-axis label (append unit if present) */
        plotType.yl += !parameter.u || parameter.u.length < 1 ?
            '' : ' (' + parameter.u + ')';

        /* is there an increment? */
        if (parameter.ii) {
            parameter.it = parameter.it ? parameter.it.trim() : null;
            parameter.iu = parameter.iu ? parameter.iu.trim() : null;

            switch (parameter.it) {
                case 'float':
                    /* if unit is minutes, plot as series; otherwise, scatter */
                    if ('minutes' === parameter.iu ||
                        'seconds' === parameter.iu) {
                        plotType.t = 'series';
                        plotType.xt = 'i';
                    } else {
                        plotType.t = 'scatter';
                        plotType.xt = 'f';
                    }

                    /* convertor function for increment values */
                    plotType.xc = getDataConvertor(parameter.it);
                    plotType.xl = parameter.iu; /* prepare x-axis label */
                    break;

                case 'repeat':
                    plotType.t = 'series'; /* plot as series */
                    plotType.xl = parameter.iu; /* prepare x-axis label */

                    /* convertor function for increment values */
                    switch (parameter.iu) {
                        case 'number':
                        case 'Age In Days':
                            plotType.xc = getDataConvertor('integer');
                            plotType.xt = 'i';
                            break;

                        case 'Time in hours relative to lights out':
                            plotType.xc = getDataConvertor('float');
                            plotType.xt = 'f';
                            break;

                        default:
                            plotType.xc = getDataConvertor('float');
                            plotType.xt = 'f';
                    }
                    break;

                case 'datetime':
                    plotType.t = 'series'; /* plot as series */
                    plotType.xl = parameter.iu; /* prepare x-axis label */

                    /* convertor function for increment values */
                    switch (parameter.iu) {
                        case 'Time in hours relative to lights out':
                            plotType.xc = getDataConvertor('float');
                            plotType.xt = 'f';
                            break;

                        default:
                            plotType.xt = 'd';
                            plotType.xc = getDataConvertor('date/time');
                            plotType.xl = "Experiment date";
                    }
                    break;
            }

            /* make first character uppercase */
            if (plotType.xl)
                plotType.xl = plotType.xl.icap();
        } else {
            plotType.t = 'point';

            /* if there are no increments, the experiment start date gives
             * the x-axis values, and these are date values. */
            plotType.xt = 'd';
            plotType.xc = getDataConvertor('date/time');
            plotType.xl = "Experiment date";
        }
        if (plotType.yl)
            plotType.yl = plotType.yl.icap();

        /**
         * Special case for dervied parameter: Body weight
         */
        if (parameter.e === 'IMPC_BWT_001_001') {
            plotType.t = 'series';
            plotType.xl = 'Age In Weeks';
            plotType.xc = getDataConvertor('float');
            plotType.xt = 'f';
        }

        return plotType;
    }

    function getYValueType(datatype) {
        switch (datatype) {
            case 'INT':
                return 'i';

            case 'DATETIME':
                return 'd';

            case 'TEXT':
                return 't';
            case 'FLOAT':
            default:
                return 'f';

        }
    }

    /**
     * Returns a function that converts a string to an appropriate data type.
     *
     * @param {String} datatype Data type for conversion from string.
     * @return A convertor function.
     */
    function getDataConvertor(datatype) {
        var convertor;
        switch (datatype) {
            case 'FLOAT':
            case 'float':
                convertor = function (d) {
                    return parseFloat(d);
                };
                break;

            case '1-n':
            case 'INT':
            case 'INTEGER':
            case 'integer':
                convertor = function (d) {
                    return parseInt(d, 10);
                };
                break;

            case 'date/time':
            case 'DATE/TIME':
                convertor = function (d) {
                    return new Date(d);
                };
                break;

            case 'TEXT':
            case 'text':
                convertor = function (d) {
                    return d;
                };
                break;

            default:
                convertor = function (d) {
                    return d;
                };
        }
        return convertor;
    }

    /**
     * Process the raw data that was retrieved from the server. This prepares
     * the data for statistical calculations.
     *
     * @param {Object} data Raw data to process.
     * @param {Object} type Plot type that determines the manner of processing.
     * @returns {Array} Processed data ready for statistical calculations.
     */
    function processData(data, type) {
        var processed = [], i, c = data.length, datum, x, y, date,
            /* string-to-datatype convertors for x- and y-axis values */
            xc = type.xc, yc = type.yc;

        for (i = 0; i < c; ++i) {
            datum = data[i];
            date = new Date(datum.d); /* measurement date */

            /* x-axis stores the increment value. if undefined, take the
             * measurement date and increment value. */
            x = datum.i;
            if (x === undefined)
                x = date;
            else if (xc)
                x = xc(x); /* if convertor is defined, convert value */

            y = datum.v;
            if (y !== undefined && yc)
                y = yc(y);

            if (isFinite(x) || x instanceof Date)
                if (isFinite(y))
                    processed.push({
                        e: datum.e, /* metadata group */
                        m: datum.m, /* measurement id */
                        x: x, /* x-axis increments */
                        y: y, /* y-axis value */
                        d: date,
                        s: datum.s, /* sex */
                        z: datum.z, /* zygosity */
                        g: datum.g, /* genotype */
                        t: datum.t, /* strain id */
                        a: datum.a, /* animal identifier */
                        n: datum.n, /* animal name */
                        fi: datum.x, /* tracker id of XML file */
                        fd: new Date(datum.u) /* last time the tracker id was updated */
                    });
        }
        return processed;
    }

    /**
     * When we attach a selector, we want the brush to be enabled outside the
     * range that corresponds to the domain defined by the data set. This means
     * that we must create a scale which allows us to extend beyoung the normal
     * range, so that the brush can start and end outside the allowed range. To
     * do this, we will be adding extra padding. Since this padding is define
     * by an integral number of pixels, we must use the inverse of the current
     * scale to create the extended scale.
     *
     * @param {Object} viz The visualisation object.
     * @returns {Object} boxScale Scale to be used by the box selector,
     *         which covers the entire visualisation chart.
     */
    function getVisualisationScaler(viz) {
        var boxScale = {}, visualisationDimension = viz.chart.dim,
            width = visualisationDimension.w, height = visualisationDimension.h;
        boxScale.x = getLinearScaler(0, width, 0, width);
        boxScale.y = getLinearScaler(0, height, 0, height);
        return boxScale;
    }

    /**
     * Returns a screen coordinate convertor, which ensures that the
     * bounding coordinates of the box selector extent always lies in the
     * region defined by the sceen coordinates (range) of the data point values.
     *
     * @param {Array} xRange Low and high screen x-coordinates of data region.
     * @param {Array} yRange Low and high screen y-coordinates of data region.
     * @returns {Function} Convertor function that takes extent and returns
     *         new extent that is inside the data region.
     */
    function getSelectorExtentConvertor(xRange, yRange) {
        var xrl = xRange[0], xrh = xRange[1],
            yrl = yRange[1], yrh = yRange[0];

        return function (extent) {
            /* extent bounds: t - top, b - bottom, l - left, r - right */
            var tlx = extent[0][0], brx = extent[1][0],
                tly = extent[0][1], bry = extent[1][1];

            /* the offset by 1 pixel ensures that the box selector extent
             * always intersects the data region boundary for it to effectively
             * contain any data point. Otherwise, boundary data points will
             * always fall inside the extent, even when the extent itself is
             * outside the data region. */
            extent[0][0] = tlx < xrl ? xrl - 1 : tlx > xrh ? xrh + 1 : tlx;
            extent[0][1] = tly < yrl ? yrl - 1 : tly > yrh ? yrh + 1 : tly;
            extent[1][0] = brx < xrl ? xrl - 1 : brx > xrh ? xrh + 1 : brx;
            extent[1][1] = bry < yrl ? yrl - 1 : bry > yrh ? yrh + 1 : bry;

            return extent;
        };
    }

    /**
     * Checks if the data point is inside the extent of the selector box.
     *
     * @param {Object} datapoint Datapoint to check against bounding box.
     * @param {Object} extent The bounding box of the box selector.
     */
    function isInsideBoxSelector(datapoint, extent) {
        return extent[0][0] <= datapoint.sx
            && datapoint.sx <= extent[1][0]
            && extent[0][1] <= datapoint.sy
            && datapoint.sy <= extent[1][1];
    }

    /**
     * Mark all data points inside the box for selection.
     *
     * @param {Object} svg SVG node that contains the data points.
     * @param {Object} selector The box selector.
     * @param {Object} extent The bounding box of the box selector.
     */
    function markForSelection(svg, selector, extent) {
        svg.selectAll(selector)
            .classed('to-select', function (d) {
                return isInsideBoxSelector(d, extent)
                    && !selectedDatapoints.contains(d.m)
                    ? true : false;
            });
    }

    /**
     * Mark all data points inside the box for removal.
     *
     * @param {Object} svg SVG node that contains the data points.
     * @param {Object} selector The box selector.
     * @param {Object} extent The bounding box of the box selector.
     */
    function markForRemoval(svg, selector, extent) {
        svg.selectAll(selector)
            .classed('to-remove', function (d) {
                return isInsideBoxSelector(d, extent) ? true : false;
            });
    }

    /**
     * Attaches a rectangular data point selector, or deselector.
     *
     * <p>The box selector operates under two modes, as follows:
     * <ul>
     * <li>If the 'highlight selected data points' is enabled, all of the data
     * points selected using the box selector will be removed from the set of
     * selected data points.
     * </li>
     * <li>On the other hand, if the 'highlight selected data points' is
     * disabled, then all of the data points selected using the box selector
     * will be added to the set of selected data points. If the data points
     * were already selected, they will continue to exist in this set.
     * </li>
     * </ul>
     * </p>
     *
     * @param {Object} viz The visualisation object.
     * @param {String} mode If <b>select</b>, use selection mode; otherwise,
     *        use deselect mode (when selected points have been highlighted).
     *
     * @return {Object} The modified DOM element.
     */
    function attachBoxSelector(viz, mode) {
        var scale = viz.scale, xScale = scale.x, yScale = scale.y,
            xRange = xScale.range(), yRange = yScale.range(),
            isSelect = mode === 'select' ? true : false,
            box = viz.state.n.b, datapointType,
            svg = isSelect ? viz.state.n.v : viz.state.n.h
            ;

        svg.selectAll('.box-selector').remove();
        var k = svg.append('g').attr('class', 'box-selector'),
            boxScale = getVisualisationScaler(viz),
            convertExtent = getSelectorExtentConvertor(xRange, yRange);

        box.on('brushstart', function (p) {
            informationBoxIsDisabled = true;

            datapointType = (viz.isActiveCtrl('shapes')
                && viz.type !== 'series' && !viz.isActiveCtrl('swarm')
                ? 'text' : 'circle');
            if (box.data !== p) {
                k.call(box.clear());
                box.x(boxScale.x).y(boxScale.y).data = p;
            }
        })
            .on('brush', function () {
                var e = convertExtent(box.extent());
                if (isSelect) {
                    if (viz.isActiveCtrl('highlight') &&
                        viz.isActiveCtrl('high_point'))
                        markForSelection(svg, '.series.highlighted ' +
                            datapointType, e);

                    if (viz.isActiveCtrl('point'))
                        markForSelection(svg, '.mutant-datapoints ' +
                            datapointType, e);
                } else {
                    markForRemoval(svg, 'circle', e);
                }
            })
            .on('brushend', function () {
                informationBoxIsDisabled = false;
                if (isSelect) {
                    svg.selectAll('.to-select')
                        .classed('selected', function (d) {
                            selectedDatapoints.add(d.m, d);
                            return true;
                        })
                        .classed('to-select', false);
                } else {
                    svg.selectAll('.highlight-selection circle.to-remove')
                        .attr('class', function (d) {
                            selectedDatapoints.remove(d.m);
                        })
                        .remove();
                }
                k.call(box.clear());
            });
        k.call(box.x(boxScale.x).y(boxScale.y));
        return svg;
    }

    function objectIsEmpty(t) {
        var k;
        for (k in t)
            return false;
        return true;
    }

    var Visualisation = function (id, container, gid, sid, cid, lid, qeid, useSharedControl) {
        this.id = id; /* identifies the visualisation (must be unique) */
        this.container = container;
        this.cid = cid;
        this.lid = lid;
        this.gid = gid;
        this.sid = sid;
        this.geneId = prepareGeneStrainCentrePipelineId(gid, sid, cid, lid);
        this.qeid = qeid;

        /* the dimensions of the visualisation, including controls */
        this.dim = {
            'w': getNodeDimension(container, 'width'),
            'h': getNodeDimension(container, 'height'),
            'p': 80
        };

        this.scale = {
            'x': null, /* x-axis scale */
            'y': null /* y-axis scale */
        };


        this.control = {
            'dim': {
                'w': 300, /* from CSS */
                'h': this.dim.h
            }
        };

        this.chart = {
            'dim': {
                'w': this.dim.w,
                'h': this.dim.h
            }
        };

        this.prop = {
            'y': 'y', /* measured value */
            'g': 'a', /* animal id */
            'i': 'm' /* measurement id */
        };

        if (useSharedControl === undefined) {
            this.isActiveCtrl = this.isSelfActiveCtrl;
            this.hasActiveCtrls = this.hasSelfActiveCtrls;
        } else {
            this.isActiveCtrl = this.isSharedActiveCtrl;
            this.hasActiveCtrls = this.hasSharedActiveCtrls;
        }

        this.state = {
            'n': {
                'v': container.append('svg')
                    .attr('id', this.id + '-svg')
                    .attr('width', this.chart.dim.w)
                    .attr('height', this.chart.dim.h),
                'a': {}
            },
            'q': {},
            'o': {
                'series': 0,
                'point': 0
            }
        };
        this.init();
    };

    /**
     * Prototype definition for a visualisation object.
     */
    Visualisation.prototype = {
        /* reference to function that checks if a control is active. This
         * depends on whether a shared control is used. Set his reference
         * to isSelfActiveCtrl() when visualisation must use control settings
         * specific to the visualisation; otherwise, use isSharedActiveCtrl().
         */
        isActiveCtrl: null,
        isSelfActiveCtrl: function (k) {
            var me = this;
            return (me.state.o[me.type] & controlOptions[k]) > 0;
        },
        isSharedActiveCtrl: function (k) {
            return (dcc.visualisationControl & controlOptions[k]) > 0;
        },
        /* reference to function that checks if several controls are active.
         * This also depends on whether a shared control is used. Set this
         * reference to hasSelfActiveCtrl() when visualisation must use control
         * settings specific to the visualisation; otherwise, use
         * hasSharedActiveCtrl().
         */
        hasActiveCtrls: null,
        hasSelfActiveCtrls: function (controlsBitMap) {
            var me = this;
            return (me.state.o[me.type] & controlsBitMap) > 0;
        },
        hasSharedActiveCtrls: function (controlsBitMap) {
            return (dcc.visualisationControl & controlsBitMap) > 0;
        },
        refresh: function () {
            var me = this, state = me.state;

            if (isNaN(me.dim.h) || isNaN(me.dim.w))
                return;

            me.switchMeasurement();

            state.n.v.selectAll('.viz-warning').remove();
            if (me.nodata || state.mutantStatistics === null
                || (state.mutantStatistics &&
                    state.mutantStatistics.genderCombined === null)) {
                var msg;

                switch (zygosity) {
                    case 1:
                        msg = 'Heterozygous';
                        break;
                    case 2:
                        msg = 'Homozygous';
                        break;
                    case 3:
                        msg = 'Hemizygous';
                        break;
                    default:
                        msg = 'all';
                }
                state.n.v.selectAll('g').remove();
                me.warn('No measurements for ' + msg + ' specimens');
                return;
            }

            if (me.type === 'point') {
                if (me.isActiveCtrl('swarm')) {
                    state.refreshFunction = swarmPlot;
                    state.n.v.select('.x-axis').remove();
                } else
                    state.refreshFunction = seriesPlot;
            }
            if (state.refreshFunction)
                state.refreshFunction(me);
            me.highlight();
            me.showMetadataGroups();
        },
        warn: function (msg) {
            var me = this, g = me.state.n.v;
            text(g, me.chart.dim.w * .5,
                me.chart.dim.h * .5, msg, 'viz-warning');
        },
        title: function () {
            var me = this, g = me.state.n.v, t;
            g.select('.viz-title').remove();
            t = text(g, me.chart.dim.w * .5,
                me.dim.p * .35, '', 'viz-title');
            t.append('tspan').text(me.label.t.p + ' ');
            t.append('tspan').text(me.label.t.q);
        },
        legends: function () {
            var me = this, g = me.state.n.v, t, showBaselinePointLegend,
                x = me.dim.p * 0.75, y = me.dim.p - 20;
            g.select('.viz-legends').remove();

            t = g.append('g').attr('class', 'viz-legends');
            showBaselinePointLegend = me.isActiveCtrl('wildtype') &&
                me.type === "point" && me.gid !== 0;

            if (me.isActiveCtrl('female')) {
                circle(t, x, y, 5, 'female');
                x += 10;
                text(t, x, y + 5, 'Female');
                x += 55;

                if (showBaselinePointLegend) {
                    square(t, x, y - 10, 10, 'female');
                    x += 10;
                    text(t, x, y + 5, 'Female (WT)');
                    x += 85;
                }
            }

            if (me.isActiveCtrl('male')) {
                circle(t, x, y, 5, 'male');
                x += 10;
                text(t, x, y + 5, 'Male');
                x += 40;

                if (showBaselinePointLegend) {
                    square(t, x, y - 10, 10, 'male');
                    x += 10;
                    text(t, x, y + 5, 'Male (WT)');
                    x += 70;
                }
            }

            x -= 15;
            if (me.type === 'series' && me.isActiveCtrl('polyline'))
                x += 10;

            if (me.isActiveCtrl('newdata')) {
                circle(t, x + 15, y, 5, 'legend-newdata');
                if (me.type === 'series' && me.isActiveCtrl('polyline')) {
                    line(t, x, y, x + 30, y, 'legend-newdata');
                    x += 35;
                } else
                    x += 25;
                text(t, x, y + 5, 'New data');
                x += 65;
            } else {
                if (me.isActiveCtrl('highlight')) {
                    circle(t, x + 15, y, 5, 'legend-highlighted');
                    if (me.type === 'series' && me.isActiveCtrl('polyline')) {
                        line(t, x, y, x + 30, y, 'legend-highlighted');
                        x += 35;
                    } else
                        x += 25;
                    text(t, x, y + 5, 'Highlighted');
                    x += 65;
                }
                circle(t, x + 15, y, 5, 'legend-selected');
                x += 25;
                text(t, x, y + 5, 'Selected');
                x += 65;
            }

            if (me.gid !== 0 && me.isActiveCtrl('whisker')) {
                rect(t, x, y - 5, 10, 10, 'whisker mutant');
                x += 15;
                text(t, x, y + 5, 'Mutant');
                x += 53;

                if (me.isActiveCtrl('wildtype')) {
                    rect(t, x, y - 5, 10, 10, 'whisker wildtype');
                    x += 15;
                    text(t, x, y + 5, 'Wild type');
                    x += 65;
                }
            }

            if (me.isActiveCtrl('statistics') && me.isActiveCtrl('polyline')) {
                /* We display a dotted wild type when any of the following
                 * controls is active:
                 *
                 * mean: 0x1
                 * median: 0x2
                 * max: 0x4
                 * min: 0x8
                 * quartile: 0x10
                 *
                 * Or'ing them gives 31.
                 */
                if (me.gid !== 0 && me.hasActiveCtrls(31)) {
                    if (me.isActiveCtrl('wildtype')) {
                        line(t, x, y, x + 30, y, 'wildtype');
                        x += 30;
                        text(t, x, y + 5, 'Wild type');
                        x += 65;
                    }
                }

                if (me.isActiveCtrl('min')) {
                    line(t, x, y, x + 20, y, 'min');
                    x += 25;
                    text(t, x, y + 5, 'Min');
                    x += 35;
                }
                if (me.isActiveCtrl('max')) {
                    line(t, x, y, x + 20, y, 'max');
                    x += 25;
                    text(t, x, y + 5, 'Max');
                    x += 35;
                }
                if (me.isActiveCtrl('mean')) {
                    line(t, x, y, x + 20, y, 'mean');
                    x += 25;
                    text(t, x, y + 5, 'Mean');
                    x += 40;
                }
                if (me.isActiveCtrl('median')) {
                    line(t, x, y, x + 20, y, 'median');
                    x += 25;
                    text(t, x, y + 5, 'Median');
                    x += 50;
                }
                if (me.isActiveCtrl('quartile')) {
                    line(t, x, y, x + 20, y, 'q1');
                    x += 25;
                    text(t, x, y + 5, 'Q1');
                    x += 25;
                    line(t, x, y, x + 20, y, 'q3');
                    x += 25;
                    text(t, x, y + 5, 'Q3');
                    x += 25;
                }
            }
        },
        legendsShapes: function () {
            var me = this, g = me.state.n.v, t, showBaselinePointLegend,
                x = me.dim.p * 0.75, y = me.dim.p - 20;
            g.select('.viz-legends').remove();

            t = g.append('g').attr('class', 'viz-legends');
            showBaselinePointLegend = me.isActiveCtrl('wildtype') &&
                me.type === "point" && me.gid !== 0;

            if (me.isActiveCtrl('female')) {
                text(t, x, y, me.getSymbol('mutant', 'female'), 'm-female');
                x += 10;
                text(t, x, y + 5, 'Female');
                x += 55;

                if (showBaselinePointLegend) {
                    text(t, x, y, me.getSymbol('wildtype', 'female'), 'wt-female');
                    x += 10;
                    text(t, x, y + 5, 'Female (WT)');
                    x += 85;
                }
            }

            if (me.isActiveCtrl('male')) {
                text(t, x, y, me.getSymbol('mutant', 'male'), 'm-male');
                x += 10;
                text(t, x, y + 5, 'Male');
                x += 40;

                if (showBaselinePointLegend) {
                    text(t, x, y, me.getSymbol('wildtype', 'male'), 'wt-male');
                    x += 10;
                    text(t, x, y + 5, 'Male (WT)');
                    x += 70;
                }
            }

            x -= 15;
            if (me.type === 'series' && me.isActiveCtrl('polyline'))
                x += 10;

            if (me.isActiveCtrl('newdata')) {
                circle(t, x + 15, y, 5, 'legend-newdata');
                if (me.type === 'series' && me.isActiveCtrl('polyline')) {
                    line(t, x, y, x + 30, y, 'legend-newdata');
                    x += 35;
                } else
                    x += 25;
                text(t, x, y + 5, 'New data');
                x += 65;
            } else {
                if (me.isActiveCtrl('highlight')) {
                    circle(t, x + 15, y, 5, 'legend-highlighted');
                    if (me.type === 'series' && me.isActiveCtrl('polyline')) {
                        line(t, x, y, x + 30, y, 'legend-highlighted');
                        x += 35;
                    } else
                        x += 25;
                    text(t, x, y + 5, 'Highlighted');
                    x += 65;
                }
                circle(t, x + 15, y, 5, 'legend-selected');
                x += 25;
                text(t, x, y + 5, 'Selected');
                x += 65;
            }

            if (me.gid !== 0 && me.isActiveCtrl('whisker')) {
                rect(t, x, y - 5, 10, 10, 'whisker mutant');
                x += 15;
                text(t, x, y + 5, 'Mutant');
                x += 53;

                if (me.isActiveCtrl('wildtype')) {
                    rect(t, x, y - 5, 10, 10, 'whisker wildtype');
                    x += 15;
                    text(t, x, y + 5, 'Wild type');
                    x += 65;
                }
            }

            if (me.isActiveCtrl('statistics') && me.isActiveCtrl('polyline')) {
                /* We display a dotted wild type when any of the following
                 * controls is active:
                 *
                 * mean: 0x1
                 * median: 0x2
                 * max: 0x4
                 * min: 0x8
                 * quartile: 0x10
                 *
                 * Or'ing them gives 31.
                 */
                if (me.gid !== 0 && me.hasActiveCtrls(31)) {
                    if (me.isActiveCtrl('wildtype')) {
                        line(t, x, y, x + 30, y, 'wildtype');
                        x += 30;
                        text(t, x, y + 5, 'Wild type');
                        x += 65;
                    }
                }

                if (me.isActiveCtrl('min')) {
                    line(t, x, y, x + 20, y, 'min');
                    x += 25;
                    text(t, x, y + 5, 'Min');
                    x += 35;
                }
                if (me.isActiveCtrl('max')) {
                    line(t, x, y, x + 20, y, 'max');
                    x += 25;
                    text(t, x, y + 5, 'Max');
                    x += 35;
                }
                if (me.isActiveCtrl('mean')) {
                    line(t, x, y, x + 20, y, 'mean');
                    x += 25;
                    text(t, x, y + 5, 'Mean');
                    x += 40;
                }
                if (me.isActiveCtrl('median')) {
                    line(t, x, y, x + 20, y, 'median');
                    x += 25;
                    text(t, x, y + 5, 'Median');
                    x += 50;
                }
                if (me.isActiveCtrl('quartile')) {
                    line(t, x, y, x + 20, y, 'q1');
                    x += 25;
                    text(t, x, y + 5, 'Q1');
                    x += 25;
                    line(t, x, y, x + 20, y, 'q3');
                    x += 25;
                    text(t, x, y + 5, 'Q3');
                    x += 25;
                }
            }
        },
        xaxis: function () {
            var me = this, g = me.state.n.v;
            plotAxis('x', me, 'bottom', me.label.x);
        },
        yaxis: function () {
            var me = this, g = me.state.n.v;
            plotAxis('y', me, 'left', me.label.y);
        },
        errorbar: function (index) {
            var me = this, i,
                dataPoint, groupIdPrefix = 'ebar-group-' + index + '_',
                containerDomNode = me.state.n.s, /* contains all statistics visuals */
                statistics = getStatistics(me, true), /* get mutant statistics */
                seriesDataPoints = statistics.r.r[index].d,
                numDataPoints = seriesDataPoints.length, deviation,
                deviationGetter = me.isActiveCtrl('std_err') ?
                getColumnStandardError : getColumnStandardDeviation;

            containerDomNode.selectAll('[class*="ebar-group-"]').remove();
            for (i = 0; i < numDataPoints; ++i) {
                dataPoint = seriesDataPoints[i];
                deviation = deviationGetter(statistics, dataPoint.x);
                if (!isNaN(deviation))
                    plotErrorBar(groupIdPrefix + i, me,
                        dataPoint.x, dataPoint.y, deviation, 10);
            }
        },
        whisker: function () {
            var me = this, i, temp,
                containerDomNode = me.state.n.s, /* contains all statistics visuals */
                mutantStatistics = getStatistics(me, true),
                wildtypeStatistics = getStatistics(me, false),
                numColumnGroups;
            if (me.isActiveCtrl('whisker')) {
                if (me.isActiveCtrl('wildtype') && wildtypeStatistics !== null) {
                    /* get column statistics for each x-axis value */
                    wildtypeStatistics = wildtypeStatistics.c.c;

                    /* show box and whisker plot for each of the x-axis values */
                    numColumnGroups = wildtypeStatistics.length;
                    for (i = 0; i < numColumnGroups; ++i) {
                        temp = wildtypeStatistics[i];
                        plotBoxAndWhisker('group-' + i, me, temp.s, temp.k,
                            40, 16, 'wildtype');
                    }
                }

                if (mutantStatistics !== null) {
                    /* get column statistics for each x-axis value */
                    mutantStatistics = mutantStatistics.c.c;

                    /* show box and whisker plot for each of the x-axis values */
                    numColumnGroups = mutantStatistics.length;
                    for (i = 0; i < numColumnGroups; ++i) {
                        temp = mutantStatistics[i];
                        plotBoxAndWhisker('group-' + i, me, temp.s, temp.k,
                            0, 16, me.gid === 0 ? 'wildtype' : 'mutant');
                    }
                }
            } else
                containerDomNode.selectAll('.whisker').remove();
        },
        switchMeasurement: function () {
            var me = this, state = me.state, mutantData, wildtypeData,
                data = measurementsSet[zygosity];

            if (!data) {
                me.nodata = true;
                return false;
            }

            me.nodata = false;
            mutantData = data.mutant;
            wildtypeData = data.wildtype;

            me.ptype = data.plottype;
            me.type = me.ptype.t;
            me.label = {
                't': {
                    'p': me.ptype.l,
                    'q': me.ptype.yl
                },
                'x': me.ptype.xl
            };

            state.mutantStatistics = mutantData.statistics;
            state.wildtypeStatistics = wildtypeData.statistics;
            state.mutantDataset = mutantData.dataset;
            state.wildtypeDataset = wildtypeData.dataset;
            return true;
        },
        init: function () {
            var me = this, state = me.state;
            if (!me.switchMeasurement())
                return;

            switch (me.type) {
                case 'series':
                    me.prop.x = 'x'; /* attribute name for increment value */
                    state.refreshFunction = seriesPlot; /* function to call upon refresh */
                    break;

                case 'point':
                    me.prop.x = 'd'; /* attribute name for increment value */
                    state.refreshFunction = swarmPlot; /* function to call upon refresh */
                    break;

                case 'nominal':
                    state.refreshFunction = categoricalPlot;
                    break;

                default:
            }
        },
        stat: function (statisticsType) {
            var me = this, containerDomNode = me.state.n.s;
            if (me.isActiveCtrl(statisticsType) && me.ptype.t === 'series') {
                var mutantStatistics = getStatistics(me, true),
                    wildtypeStatistics = getStatistics(me, false),
                    showDataPoints = me.isActiveCtrl('point'),
                    showPolyline = me.isActiveCtrl('polyline'),
                    /* function to retrieve unscaled data points */
                    getData = function (d) {
                        return {
                            m: d.m,
                            a: d.a,
                            x: d.k,
                            y: d.s[statisticsType]
                        };
                    };

                /* show wildtype visual */
                if (me.isActiveCtrl('wildtype') && wildtypeStatistics !== null) {
                    plotSeries('wildtype-' + statisticsType, /* DOM id */
                        /* column statistics: for all x-axis values */
                        wildtypeStatistics.c.c,
                        getData,
                        me, /* use this visualisation object for the rendering */
                        containerDomNode, /* where to render to */
                        null, /* on mouse click */
                        null, /* on mouse enter */
                        null, /* on mouse move */
                        showDataPoints, /* should we display data point */
                        showPolyline, /* should we display ployline */
                        'c', /* draw circle */
                        STAT_DATAPOINT_RADIUS);
                }

                /* show mutant visual */
                if (mutantStatistics !== null) {
                    plotSeries(statisticsType, /* DOM identifier */
                        /* column statistics: for all x-axis values */
                        mutantStatistics.c.c,
                        getData,
                        me, /* use this visualisation object for the rendering */
                        containerDomNode, /* where to render to */
                        null, /* on mouse click */
                        null, /* on mouse enter */
                        null, /* on mouse move */
                        showDataPoints, /* should we display data point */
                        showPolyline, /* should we display ployline */
                        'c', /* draw circle */
                        STAT_DATAPOINT_RADIUS);
                }
            } else
                containerDomNode.selectAll('.' + statisticsType).remove();
        },
        bar: function (statisticsType) {
            var me = this, containerDomNode = me.state.n.s;
            if (me.isActiveCtrl(statisticsType)) {
                var mutantStatistics = getStatistics(me, true),
                    wildtypeStatistics = getStatistics(me, false),
                    showDataPoints = me.isActiveCtrl('point'),
                    showPolyline = me.isActiveCtrl('polyline'),
                    /* function to retrieve unscaled data points */
                    getData = function (d) {
                        return {
                            m: d.m,
                            a: d.a,
                            x: d.k,
                            y: d.s[statisticsType]
                        };
                    };

                /* show wild type visual */
                if (me.isActiveCtrl('wildtype') && wildtypeStatistics !== null) {
                    plotSeries('wildtype-' + statisticsType, /* DOM id */
                        /* column statistics: for all x-axis values */
                        wildtypeStatistics.c.c,
                        getData,
                        me, /* use this visualisation object for the rendering */
                        containerDomNode, /* where to render to */
                        null, /* click event-handler (currently not used) */
                        null,
                        null,
                        showDataPoints, /* should we display data point */
                        showPolyline, /* should we display ployline */
                        'c', /* draw circle */
                        3); /* radius of the data point circle in pixel */
                }

                /* show mutant visual */
                if (mutantStatistics !== null) {
                    plotSeries(statisticsType, /* DOM identifier */
                        /* column statistics: for all x-axis values */
                        mutantStatistics.c.c,
                        getData,
                        me, /* use this visualisation object for the rendering */
                        containerDomNode, /* where to render to */
                        null, /* click event-handler (currently not used) */
                        null,
                        null,
                        showDataPoints, /* should we display data point */
                        showPolyline, /* should we display ployline */
                        'c', /* draw circle */
                        3); /* radius of the data point circle in pixel */
                }
            } else
                containerDomNode.selectAll('.' + statisticsType).remove();
        },
        overallstat: function () {
            var me = this, mutantStatistics, wildtypeStatistics;
            if (me.type === 'point' && me.isActiveCtrl('polyline')) {
                mutantStatistics = getStatistics(me, true);
                wildtypeStatistics = getStatistics(me, false);
                if (me.gid === 0) {
                    plotStatistics(me, mutantStatistics.overall.y, 10, true);
                } else {
                    if (wildtypeStatistics && me.isActiveCtrl('wildtype'))
                        plotStatistics(me, wildtypeStatistics.overall.y, 10, true);
                    if (mutantStatistics !== null)
                        plotStatistics(me, mutantStatistics.overall.y, 10, false);
                }
            }
        },
        quartiles: function () {
            var me = this, mutantStatistics = getStatistics(me, true),
                wildtypeStatistics = getStatistics(me, false),
                containerDomNode = me.state.n.s; /* contains all statistics visuals */

            if (me.isActiveCtrl('quartile')) {
                var showDataPoints = me.isActiveCtrl('point'),
                    showPolyline = me.isActiveCtrl('polyline'),
                    showBaseline = me.isActiveCtrl('wildtype') &&
                    wildtypeStatistics !== null;

                if (showBaseline) {
                    plotSeries('wildtype-q1', wildtypeStatistics.c.c, getQ1,
                        me, containerDomNode, null, null, null, showDataPoints,
                        showPolyline, 'c', STAT_DATAPOINT_RADIUS);
                    plotSeries('wildtype-q3', wildtypeStatistics.c.c, getQ3,
                        me, containerDomNode, null, null, null, showDataPoints,
                        showPolyline, 'c', STAT_DATAPOINT_RADIUS);
                }

                if (mutantStatistics !== null) {
                    plotSeries('q1', mutantStatistics.c.c, getQ1,
                        me, containerDomNode, null, null, null, showDataPoints,
                        showPolyline, 'c', STAT_DATAPOINT_RADIUS);
                    plotSeries('q3', mutantStatistics.c.c, getQ3,
                        me, containerDomNode, null, null, null, showDataPoints,
                        showPolyline, 'c', STAT_DATAPOINT_RADIUS);
                }
            } else {
                containerDomNode.selectAll('.q1').remove();
                containerDomNode.selectAll('.q3').remove();
            }
        },
        showMutantDatapointSwarm: function (femaleAxis, maleAxis) {
            var me = this, statistics = getStatistics(me, true);
            if (statistics && statistics.r && statistics.r.r)
                showDatapointSwarm(me, statistics.r.r, 'mutant-datapoints',
                    femaleAxis, maleAxis, me.gid === 0 ?
                    WILDTYPE_DATAPOINT_RADIUS : MUTANT_DATAPOINT_RADIUS, true);
        },
        showBaselineDatapointSwarm: function (femaleAxis, maleAxis) {
            var me = this, statistics = getStatistics(me, false);
            if (statistics && statistics.r && statistics.r.r)
                showDatapointSwarm(me, statistics.r.r, 'wildtype-datapoints',
                    femaleAxis, maleAxis, WILDTYPE_DATAPOINT_RADIUS, false);
        },
        plotSeriesSwarm: function (statistics, type, radius, leaning) {
            var me = this, i, c, data, columnDataset, clickable;

            /* when displaying wildtypes with mutants, all the wildtype
             * datapoints use right-leaning beeswarm. */
            clickable = leaning !== 'r';
            if (statistics && statistics.c)
                data = statistics.c.c;
            if (data) {
                for (i = 0, c = data.length; i < c; ++i) {
                    columnDataset = data[i];
                    me.swarm(columnDataset.d, columnDataset.k,
                        type, radius, leaning, clickable);
                }
            }
        },
        showDataPoints: function () {
            var me = this, state, leaning = undefined;
            if (me.isActiveCtrl('point')) {
                if (me.type === 'series') {
                    if (me.gid === 0) {
                        me.plotSeriesSwarm(getStatistics(me, true),
                            'mutant', WILDTYPE_DATAPOINT_RADIUS);
                    } else {
                        if (me.isActiveCtrl('wildtype')) {
                            me.plotSeriesSwarm(getStatistics(me, false),
                                'wildtype', WILDTYPE_DATAPOINT_RADIUS * .75, 'r');
                            leaning = 'l';
                        }
                        me.plotSeriesSwarm(getStatistics(me, true),
                            'mutant', MUTANT_DATAPOINT_RADIUS, leaning);
                    }
                } else {
                    state = me.state;
                    if (me.gid !== 0 && me.isActiveCtrl('wildtype'))
                        me.scatter('wildtype', filterByGender(state.wildtypeDataset, me), me.isActiveCtrl('shapes') ? 't' : 'r', 4);
                    me.scatter('mutant', filterByGender(state.mutantDataset, me), me.isActiveCtrl('shapes') ? 't' : 'c', 6);
                }
            }
        },
        getSymbol: function (type, gender) {
            if (gender === 'male') {
                if (type === 'wildtype') {
                    return '★';
                } else {
                    return '▲';
                }
            } else {
                if (type === 'wildtype') {
                    return '+';
                } else {
                    return '■';
                }
            }
        },
        scatter: function (id, data, type, size) {
            var me = this, i, t, state = me.state, halfSize = 0.5 * size,
                xScale = me.scale.x, yScale = me.scale.y,
                onClick = getDatapointOnMouseClickHandler(me),
                onMouseenter = getDatapointOnMouseEnterHandler(me),
                onMousemove = getDatapointOnMouseMoveHandler(me),
                highlightType = getDatapointHighlightType(me);

            for (i in data) {
                t = data[i];
                t.sx = xScale(t.x);
                t.sy = yScale(t.y);
            }

            switch (type) {
                case 't':
                    state.n.v.append('g').attr('class', id + '-datapoints')
                        .selectAll('text')
                        .data(data)
                        .enter()
                        .append('text')
                        .attr('class', function (d) {
                            return d.s === 1 ? 'male' : 'female';
                        })
                        .attr('mg', function (d) {
                            return d.e; /* metadata group */
                        })
                        .attr('mid', function (d) {
                            return d.m; /* measurement id */
                        })
                        .attr('aid', function (d) {
                            return d.a; /* animal id */
                        })
                        .attr('x',
                            function (d) {
                                return d.sx;
                            })
                        .attr('y',
                            function (d) {
                                return d.sy;
                            })
                        .text(function (d) {
                            return me.getSymbol(id, d.s === 1 ? 'male' : 'female');
                        })
                        .classed('selected',
                            function (d) {
                                var v = false;
                                if (highlightType !== 'n')
                                    v = selectedDatapoints.contains(d.m);
                                return v;
                            })
                        .classed('highlight' + (highlightType ? '-' + highlightType : ''),
                            function (d) {
                                return isHighlightDatapoint(highlightType, d);
                            })
                        .on('click', (id === 'wildtype' ? undefined : onClick))
                        .on('mouseenter', onMouseenter)
                        .on('mousemove', onMousemove);
                    break;

                case 'c':
                    state.n.v.append('g').attr('class', id + '-datapoints')
                        .selectAll('circle')
                        .data(data)
                        .enter()
                        .append('circle')
                        .attr('class', function (d) {
                            return d.s === 1 ? 'male' : 'female';
                        })
                        .attr('mg', function (d) {
                            return d.e; /* metadata group */
                        })
                        .attr('mid', function (d) {
                            return d.m; /* measurement id */
                        })
                        .attr('aid', function (d) {
                            return d.a; /* animal id */
                        })
                        .attr('cx',
                            function (d) {
                                return d.sx;
                            })
                        .attr('cy',
                            function (d) {
                                return d.sy;
                            })
                        .attr('r', halfSize)
                        .classed('selected',
                            function (d) {
                                var v = false;
                                if (highlightType !== 'n')
                                    v = selectedDatapoints.contains(d.m);
                                return v;
                            })
                        .classed('highlight' + (highlightType ? '-' + highlightType : ''),
                            function (d) {
                                return isHighlightDatapoint(highlightType, d);
                            })
                        .on('click', onClick)
                        .on('mouseenter', onMouseenter)
                        .on('mousemove', onMousemove);
                    break;

                case 'r':
                    state.n.v.append('g').attr('class', id + '-datapoints')
                        .selectAll('rect')
                        .data(data)
                        .enter()
                        .append('rect')
                        .attr('class', function (d) {
                            return d.s === 1 ? 'male' : 'female';
                        })
                        .attr('mg', function (d) {
                            return d.e; /* metadata group */
                        })
                        .attr('mid', function (d) {
                            return d.m; /* measurement id */
                        })
                        .attr('aid', function (d) {
                            return d.a; /* animal id */
                        })
                        .attr('x',
                            function (d) {
                                return d.sx - halfSize;
                            })
                        .attr('y',
                            function (d) {
                                return d.sy - halfSize;
                            })
                        .attr('width', size)
                        .attr('height', size)
                        .on('mouseenter', onMouseenter)
                        .on('mousemove', onMousemove);
            }
        },
        swarm: function (dataset, x, type, radius, leaning, clickable) {
            var me = this, state = me.state, g, i, c,
                xScale = me.scale.x, yScale = me.scale.y, swarm;

            for (i = 0, c = dataset.length; i < c; ++i)
                dataset[i].sy = yScale(dataset[i].y);

            g = state.n.v.append('g').attr('class',
                type + '-datapoints group-' + x);
            swarm = new Beeswarm(dataset, xScale(x), radius);
            plotSwarm(swarm.swarm(leaning, SWARM_BOUND), g, type, radius,
                clickable ? getDatapointOnMouseClickHandler(me) : null,
                getDatapointOnMouseEnterHandler(me),
                getDatapointOnMouseMoveHandler(me));
        },
        highlightSeries: function () {
            var me = this, index, seriesDataPoints,
                containerDomNode = me.state.n.v,
                statistics = getStatistics(me, true);
            containerDomNode.select('.series.highlighted').remove();
            if (me.isActiveCtrl('highlight')
                && highlightedSpecimen !== -1 && statistics) {
                index = statistics.r.i[highlightedSpecimen];
                if (index !== undefined) {
                    seriesDataPoints = statistics.r.r[index];
                    if (seriesDataPoints !== undefined) {
                        if (me.isActiveCtrl('errorbar'))
                            me.errorbar(index);
                        plotSeries('highlighted',
                            seriesDataPoints.d,
                            function (d) {
                                return {
                                    e: d.e,
                                    m: d.m,
                                    a: d.a,
                                    x: d.x,
                                    y: d.y,
                                    s: d.s
                                };
                            },
                            me, containerDomNode,
                            getHighlightedDatapointOnMouseClickHandler(me),
                            getHighlightedDatapointOnMouseEnterHandler(me),
                            null,
                            me.type === 'series',
                            me.isActiveCtrl('polyline'), 'c',
                            HIGHLIGHTED_DATAPOINT_RADIUS);
                    }
                }
            }
        },
        highlightDatapoint: function () {
            var me = this, containerDomNode = me.state.n.v;
            containerDomNode.selectAll('.highlight-h').classed('highlight-h', false);
            if (me.isActiveCtrl('highlight') && highlightedSpecimen !== -1) {
                containerDomNode
                    .selectAll('[aid="' + highlightedSpecimen + '"]')
                    .classed('highlight-h', true);
            }
        },
        highlight: function () {
            var me = this;
            if (me.type === 'series')
                me.highlightSeries();
            else
                me.highlightDatapoint();
        },
        crosshair: function () {
            var me = this, containerDomNode;
            if (me.isActiveCtrl('crosshair'))
                renderCrosshair(me);
            else {
                containerDomNode = me.state.n.v;
                containerDomNode.selectAll('.xhair').remove();
                containerDomNode.on('mousemove', null);
            }
        },
        showMetadataGroups: function () {
            var me = this, containerDomNode = me.state.n.v,
                x = 1.5 * me.dim.p, d, mg,
                radius = 12, distanceFromBottom = me.dim.h - .30 * me.dim.p,
                i = 0, g, textY = me.dim.h - .25 * me.dim.p;
            containerDomNode.selectAll('.metadata-group-label').remove();
            containerDomNode.selectAll('.metadata-group-circles').remove();
            if (metadataGroups && metadataGroups.groups) {
                if (metadataGroups.groups.length > 1) {
                    text(containerDomNode, .25 * me.dim.p,
                        textY, 'Metadata split:', 'metadata-group-label');
                    mg = containerDomNode.append('g')
                        .attr('class', 'metadata-group-circles');
                    d = mg.selectAll('.metadata-group')
                        .data(metadataGroups.groups);
                    g = d.enter().append('g')
                        .attr('class', 'metadata-group')
                        .on('mouseover', getMetadataGroupMouseOverHandler(me,
                            metadataGroups.diffSet))
                        .on('mouseleave', getMetadataGroupMouseOutHandler(me));

                    g.append('circle')
                        .attr('cx', function (d) {
                            var cx = x;
                            x += 2.75 * radius;
                            return cx;
                        })
                        .attr('cy', distanceFromBottom)
                        .attr('r', radius);

                    i = 0;
                    x = 1.5 * me.dim.p;
                    g.append('text')
                        .attr('x', function (d) {
                            var cx = x;
                            x += 2.75 * radius;
                            return cx;
                        })
                        .attr('y', textY)
                        .text(function (d) {
                            return ++i;
                        });

                    d.exit().remove();
                }
            }
        },
        /**
         * Highlights the data points that are currently selected. All of the
         * selected data points that are to be highlighted are redrawn over
         * a translucent mask, which covers all of the existing visuals. This helps
         * the user to establish a reference frame for the selection.
         *
         * <p>To implement this facility, we use two important parts:
         *     <ul>
         *         <li>The translucent mask DOM node is dynamically inserted over
         *         the existing visuals. All of the data points are then redrawn
         *         on top of this DOM node.</li>
         *         <li>Secndly, we esablish a new box selector, which is only
         *         effective on this translucent DOM mask. This allows a user
         *         to unselect points that are currently highlighted.<li>
         *     </ul>
         * </p>
         *
         * @param {Integer} radius Radius of the data point circle in pixels.
         */
        selected: function (radius) {
            var me = this, visualisationDomNode = me.state.n.v;

            if (me.isActiveCtrl('selected')) {
                var visualisationDimension = me.dim,
                    datapointType = me.isActiveCtrl('shapes') && !me.isActiveCtrl('swarm') ? 'text' : 'circle';

                /* add highlighted selection DOM node group */
                visualisationDomNode.selectAll('.highlight-selection').remove();
                me.state.n.h = visualisationDomNode.append('g')
                    .attr('class', 'highlight-selection');

                /* add translucent mask */
                rect(me.state.n.h, 0, 0,
                    visualisationDimension.w, visualisationDimension.h);

                if (selectedDatapoints.isEmpty()) {
                    text(me.state.n.h,
                        me.chart.dim.w * .5,
                        me.chart.dim.h * .5,
                        'No cited datapoints or selection', 'no-selection');
                } else {
                    /* attach a new box selector (for data point removal) which is
                     * effective on the translucent mask */
                    attachBoxSelector(me, 'remove');

                    /* bind the selected data points to circles */
                    var dataBinding = me.state.n.h.selectAll(datapointType)
                        .data(visualisationDomNode.selectAll(datapointType + '.selected').data());

                    /* remove existing data points that are no longer selected */
                    dataBinding.exit().remove();

                    /* add data points that are currently in the selection */
                    dataBinding.enter()
                        .append('circle')
                        .attr('r', radius)
                        .attr('cx', function (d) {
                            return d.sx;
                        })
                        .attr('cy', function (d) {
                            return d.sy;
                        })

                        /* capture and discard individual 'mousedown' and 'mouseup'
                         * events, so that only 'click' events are fired. This is
                         * necessary because the box selector fires both 'mousedown'
                         * and 'mouseup' events, in addition to the 'click' events;
                         * but we only need click */
                        .on('mouseup', function () {
                            d3.event.stopPropagation();
                        })
                        .on('mousedown', function () {
                            d3.event.stopPropagation();
                        })
                        .on('click', function (d) {
                            selectedDatapoints.remove(d.m);
                            d3.select(this).remove();
                        })
                        .on('mouseenter', getDatapointOnMouseEnterHandler(me))
                        .on('mousemove', getDatapointOnMouseMoveHandler(me));
                }

                if (numberInitiallyCited > selectedDatapoints.getCount()) {
                    text(me.state.n.h,
                        me.chart.dim.w * .5,
                        me.chart.dim.h * .5 + 20,
                        '(' +
                        (numberInitiallyCited - selectedDatapoints.getCount()) +
                        ' out of ' + numberInitiallyCited +
                        ' initially cited datapoints have since been removed)',
                        'no-selection');
                }
            } else
                visualisationDomNode.selectAll('.highlight-selection').remove();
        },
        /**
         * Display min/max value range.
         */
        minmax: function () {
            var ptype = dcc.extjs.controller.ptype;
            if (ptype.validQcBounds) {
                var me = this, g = me.state.n.v;
                g.select('.min-max-band').remove();
                if (me.isActiveCtrl('minmax')) {
                    var scale = me.scale, yScale = scale.y,
                        xRange = scale.x.range(), max = yScale(ptype.qMax);
                    rect(g, xRange[0], max, xRange[1] - xRange[0],
                        yScale(ptype.qMin) - max, 'min-max-band');
                }
            }
        }
    };

    function getSharedControlOnClickHandler(control, handler) {
        return function () {
            preventEventBubbling();
            var isOn, cls = control + '-', node = d3.select(this);
            dcc.visualisationControl ^= controlOptions[control];
            if (node.classed(cls + 'on')) {
                node.classed(cls + 'on', false);
                node.classed(cls + 'off', true);
                isOn = false;
            } else {
                node.classed(cls + 'on', true);
                node.classed(cls + 'off', false);
                isOn = true;
            }
            if (handler === undefined)
                refreshVisibleVisualisations();
            else
                handler(isOn);
        };
    }

    function addControl(toolbar, type, tip, handler) {
        var control = addDiv(toolbar, null, 'control'),
            suffix = dcc.visualisationControl &
            controlOptions[type] ? '-on' : '-off';
        if (tip !== undefined)
            control.attr('title', tip);
        control.classed(type + suffix, true);
        if (isSupportedTouchDevice === null)
            control.on('click', getSharedControlOnClickHandler(type, handler));
        else
            control.on(TOUCH_START, getSharedControlOnClickHandler(type, handler));

        return control;
    }

    function getAnimatedHeightChanger(node, height, after) {
        return function () {
            preventEventBubbling();
            node.transition().duration(ANIMATION_DURATION)
                .style('height', height + 'px')
                .each('end', after);
        };
    }

    function getAnimatedHeightToggler(node, offHeight, onHeight) {
        return function () {
            preventEventBubbling();
            var currentHeight = width(node), isOn = currentHeight === onHeight;
            currentHeight = isOn ? offHeight : onHeight;
            node.transition().duration(ANIMATION_DURATION)
                .style('height', currentHeight + 'px');
            return !isOn;
        };
    }

    function isControlOn(control) {
        return dcc.visualisationControl & controlOptions[control];
    }

    function attachHeightChanger(group, toolbarHeight, expandedHeight) {
        var on = getAnimatedHeightChanger(group, expandedHeight, null);
        group.on('mouseenter', function () {
            group.classed('control-expanded', true);
            on();
        });
        group.on('mouseleave',
            getAnimatedHeightChanger(group, toolbarHeight,
                function () {
                    group.classed('control-expanded', false);
                }));
    }

    function addControlGroup(id, toolbar, types) {
        var i, numItems = types.length, control, toolbarHeight = 40,
            expandedHeight = numItems * toolbarHeight, suffix, toggler, button,
            group = addDiv(toolbar, null, 'control-group');

        if (isSupportedTouchDevice !== null) {
            control = types[0];
            suffix = isControlOn(control.t) ? '-on' : '-off';
            button = addDiv(group, id + '-label', 'control')
                .classed(control.t + suffix, true);
        }
        for (i = 0; i < numItems; ++i) {
            control = types[i];
            addControl(group, control.t, control.l);
        }
        if (isSupportedTouchDevice === null) {
            attachHeightChanger(group, toolbarHeight, expandedHeight);
        } else {
            toggler = getAnimatedHeightToggler(group, toolbarHeight,
                expandedHeight + toolbarHeight);
            group.on(TOUCH_START, function () {
                if (toggler()) {
                    button.attr('class', 'control contract-button');
                } else {
                    control = types[0];
                    suffix = isControlOn(control.t) ? '-on' : '-off';
                    button.attr('class', 'control ' + control.t + suffix);
                }
            });
        }
    }

    function resizeVisualisations(dontRefresh) {
        var i, c, visualisation,
            height = getAspectHeight(visualisationWidth);
        for (i = 0, c = visualisationCluster.length; i < c; ++i) {
            visualisation = visualisationCluster[i];
            visualisation
                .style("width", visualisationWidth + "px")
                .style("height", height + "px");
            if (!dontRefresh)
                visualisation.isRendered = false;
        }
        if (!dontRefresh)
            refreshVisualisationCluster(true);
    }

    function getGenderOnClickHandler(type) {
        return function () {
            preventEventBubbling();
            var cls, node = d3.select(this), oldControl,
                combined = controlOptions.male | controlOptions.female,
                parent = d3.select(this.parentNode);
            parent.selectAll('.control')
                .attr('class', function () {
                    return d3.select(this).attr('type') + '-off control';
                });
            cls = node.attr('type') + '-on control';
            node.attr('class', cls);
            parent.select('#gender-label').attr('class', cls);

            oldControl = dcc.visualisationControl;
            switch (type) {
                case 'male':
                case 'female':
                    dcc.visualisationControl &= ~combined;
                    dcc.visualisationControl |= controlOptions[type];
                    break;
                case 'male_female':
                    dcc.visualisationControl |= combined;
            }
            refreshVisibleVisualisations();
        };
    }

    function addGenderOption(toolbar, type, tip) {
        var control = addDiv(toolbar, null, 'control'),
            suffix = '-off', config = dcc.visualisationControl,
            combined = controlOptions.male | controlOptions.female,
            showBoth = (config & combined) === combined;
        if ((type === 'male_female' && showBoth) ||
            (!showBoth && (config & controlOptions[type]))) {
            suffix = '-on';
            toolbar.select('#gender-label')
                .attr('class', type + suffix + ' control');
        }
        if (tip !== undefined)
            control.attr('title', tip);
        control.attr('type', type)
            .classed(type + suffix, true);
        if (isSupportedTouchDevice === null)
            control.on('click', getGenderOnClickHandler(type));
        else
            control.on(TOUCH_START, getGenderOnClickHandler(type));
        return control;
    }

    function addGenderOptions(toolbar, options) {
        var i, c = options.length, label, control, toolbarHeight = 40,
            expandedHeight = (c + 1) * toolbarHeight,
            group = addDiv(toolbar, null, 'control-group');

        label = addDiv(group, 'gender-label', 'control');
        control = options[0];
        visualisationWidth = control.v;
        addGenderOption(group, control.t, control.l);
        label.classed(control.t + '-on', true);
        for (i = 1; i < c; ++i) {
            control = options[i];
            addGenderOption(group, control.t, control.l);
        }
        if (isSupportedTouchDevice === null) {
            attachHeightChanger(group, toolbarHeight, expandedHeight);
        } else {
            group.on(TOUCH_START, getAnimatedHeightToggler(group, toolbarHeight, expandedHeight));
        }
    }

    function getZygosityOnClickHandler(type) {
        return function () {
            preventEventBubbling();
            var cls, node = d3.select(this), oldZygosity = zygosity,
                combined = controlOptions.hom |
                controlOptions.het | controlOptions.hem,
                parent = d3.select(this.parentNode);
            parent.selectAll('.control')
                .attr('class', function () {
                    return d3.select(this).attr('type') + '-off control';
                });
            cls = node.attr('type') + '-on control';
            node.attr('class', cls);
            parent.select('#zygosity-label').attr('class', cls);

            if (type === 'zygosity_all') {
                zygosity = ZYGOSITY_ALL;
                dcc.visualisationControl |= combined;
            } else {
                switch (type) {
                    case 'het':
                        zygosity = ZYGOSITY_HET;
                        break;
                    case 'hom':
                        zygosity = ZYGOSITY_HOM;
                        break;
                    case 'hem':
                        zygosity = ZYGOSITY_HEM;
                        break;
                }
                dcc.visualisationControl &= ~combined;
                dcc.visualisationControl |= controlOptions[type];
            }
            if (oldZygosity !== zygosity)
                refreshVisibleVisualisations();
        };
    }

    function addZygosityOption(toolbar, type, tip) {
        var control = addDiv(toolbar, null, 'control'),
            suffix = '-off', config = dcc.visualisationControl,
            combined = controlOptions.hom |
            controlOptions.het | controlOptions.hem,
            showAll = (config & combined) === combined;
        if ((type === 'zygosity_all' && showAll) ||
            (!showAll && (config & controlOptions[type]))) {
            suffix = '-on';
            toolbar.select('#zygosity-label')
                .attr('class', type + suffix + ' control');
        }
        if (tip !== undefined)
            control.attr('title', tip);
        control.attr('type', type)
            .classed(type + suffix, true);
        if (isSupportedTouchDevice === null)
            control.on('click', getZygosityOnClickHandler(type));
        else
            control.on(TOUCH_START, getZygosityOnClickHandler(type));
        return control;
    }

    function addZygosityOptions(toolbar, options) {
        var i, c = options.length, label, control, toolbarHeight = 40,
            expandedHeight = (c + 1) * toolbarHeight,
            group = addDiv(toolbar, null, 'control-group');

        label = addDiv(group, 'zygosity-label', 'control');
        control = options[0];
        visualisationWidth = control.v;
        addZygosityOption(group, control.t, control.l);
        label.classed(control.t + '-on', true);
        for (i = 1; i < c; ++i) {
            control = options[i];
            addZygosityOption(group, control.t, control.l);
        }
        if (isSupportedTouchDevice === null) {
            attachHeightChanger(group, toolbarHeight, expandedHeight);
        } else {
            group.on(TOUCH_START, getAnimatedHeightToggler(group, toolbarHeight, expandedHeight));
        }
    }

    dcc.showVisualisationControls = function () {
        var parent = d3.select('#sidebar'), toolbar;
        clear(parent);
        toolbar = addDiv(parent, 'controls');
        addGenderOptions(toolbar, [
            {
                't': 'male',
                'l': 'Include male specimens'
            },
            {
                't': 'female',
                'l': 'Include female specimens'
            },
            {
                't': 'male_female',
                'l': 'Include both male and female specimens'
            }
        ]);

        addZygosityOptions(toolbar, [
            {
                't': 'hom',
                'l': 'Include homozygous specimens'
            },
            {
                't': 'het',
                'l': 'Include heterozygous specimens'
            },
            {
                't': 'hem',
                'l': 'Include hemizygous specimens'
            },
            {
                't': 'zygosity_all',
                'l': 'Include all specimens'
            }
        ]);

        addControl(toolbar, 'polyline', 'Show polylines');
        addControl(toolbar, 'point', 'Show data points');
        addControl(toolbar, 'wildtype', 'Include wild type specimens');
        addControl(toolbar, 'swarm', 'Show Beewswarm plot');
        addControlGroup('whisker', toolbar, [
            {
                't': 'whisker',
                'l': 'Show box and whisker'
            },
            {
                't': 'whisker_iqr',
                'l': 'Extend whiskers to 1.5 IQR'
            }
        ]);
        addControlGroup('stat', toolbar, [
            {
                't': 'statistics',
                'l': 'Show descriptive statistics'
            },
            {
                't': 'quartile',
                'l': 'Show first and third quartiles'
            },
            {
                't': 'min',
                'l': 'Show minimum values'
            },
            {
                't': 'max',
                'l': 'Show maximum values'
            },
            {
                't': 'median',
                'l': 'Show median'
            },
            {
                't': 'mean',
                'l': 'Show arithmetic mean'
            }]);
        addControl(toolbar, 'crosshair', 'Show crosshair');
        addControlGroup('errorbar', toolbar, [
            {
                't': 'errorbar',
                'l': 'Show error bar'
            },
            {
                't': 'std_err',
                'l': 'Show standard error instead of standard deviation'
            }
        ]);
        addControl(toolbar, 'highlight', 'Highlight selected specimen');
        addControl(toolbar, 'selected', 'Highlight selected datapoints');
        addControl(toolbar, 'shapes', 'Use shapes to display datapoints\nexcept when using Beeswarm plots');
        renderButtonsPanel(parent);
        return toolbar;
    };

    /**
     * Sets new dimension for the visualisation context.
     */
    function refitContent() {
        height('#content', height("#specimen-centric-visualisation") -
            height("#sidebar"));
    }

    /**
     * Set dimension for user interface components in visualisation mode.
     */
    function refitVisualise() {
        height('#cluster', height('#content'));
    }

    /**
     * When the browser viewport is resized, we must recalculate dimensions
     * and placement for all of the user interface components. The following is
     * the event handler invoked when the browser viewport resizes.
     */
    function resize() {
        refitContent();
        refitVisualise();
    }

    /**
     * Initialises the zygosity filter based on web app startup setting.
     */
    function initZygosity() {
        var combined = controlOptions.hom |
            controlOptions.het | controlOptions.hem;
        if ((dcc.visualisationControl & combined) === combined)
            zygosity = ZYGOSITY_ALL;
        else if (dcc.visualisationControl & controlOptions.hom)
            zygosity = ZYGOSITY_HOM;
        else if (dcc.visualisationControl & controlOptions.het)
            zygosity = ZYGOSITY_HET;
        else if (dcc.visualisationControl & controlOptions.hem)
            zygosity = ZYGOSITY_HEM;
    }

    /**
     * Adds a visualisation cluster row which appends a visualisation for
     * each of the selected genes for the selected parameter.
     *
     * @param {Object} tr DOM node that represents the row for parameter.
     * @param {Integer} gid Genotype identifier.
     * @param {Integer} sid Strain identifier.
     * @param {Integer} cid Centre identifier.
     * @param {Integer} lid Pipeline identifier.
     * @param {Integer} peid Procedure key.
     * @param {String} qeid Parameter key.
     * @param {Integer} index Index inside the array of visualisations.
     * @returns {Object} DOM node that contains the visualisation object.
     */
    function addClusterRow(tr, gid, sid, cid, lid, peid, qeid, index) {
        var id = (gid % 2) + "-" + index,
            td = tr.append("td"),
            vizContainer = td.append("div")
            .attr("class", "loading viz-container-" + id);
        vizContainer.centre = cid;
        vizContainer.pipeline = lid;
        vizContainer.gene = gid;
        vizContainer.strain = sid;
        vizContainer.procedure = peid;
        vizContainer.parameter = qeid;
        vizContainer.index = index;
        return vizContainer;
    }

    /**
     * Creates the visualisation cluster, which is a two dimensional grid
     * of visualisation where the columns represent the selected gene and
     * the rows represent the selected parameters.
     *
     * @param {Object} parent DOM node that will contain the cluster.
     */
    function createVisualisationCluster(parent) {
        var table, tr, k = 0;
        parent = addDiv(parent, 'cluster');
        if (geneList.count() > 0 && parameterList.count() > 0) {
            table = parent.append("table").attr("class", "cluster");
            visualisationCluster = [];
            parameterList.traverse(function (parameter) {
                tr = table.append('tr');
                geneList.traverse(function (gene) {
                    visualisationCluster.push(
                        addClusterRow(tr, gene.gid, gene.sid, gene.cid,
                            gene.lid, parameter[PROCEDURE_KEY_FIELD],
                            parameter[PARAMETER_KEY_FIELD], k++));
                });
            });
        } else
            listIsEmpty(parent);
    }

    function attachVisualisationEventHandlers() {
        d3.select('#cluster')
            .on("scroll", function () {
                preventEventBubbling();
                informationBox.style('display', 'none');
                dcc.throttle(refreshVisualisationCluster, EVENT_THROTTLE_DELAY, null);
            });
    }

    /**
     * Display visualisation mode user interfaces.
     * @param {Object} content Content area in the UI foundation.
     */
    function showVisualise(content) {
        dcc.showVisualisationControls();
        createVisualisationCluster(content);
        attachVisualisationEventHandlers();
        resize();
    }

    /**
     * Checks if the visualisation is visible inside the visualisation cluster
     * viewport.
     *
     * @param {Object} vizContainer Visualisation container DOM node.
     * @param {Object} parent DOM node for visualisation cluster viewport.
     * @returns {Boolean} True of visualisation is visible.
     */
    function isVisualisationVisible(vizContainer, parent) {
        var vizDim = vizContainer.node().getBoundingClientRect(),
            parentDim = parent.node().getBoundingClientRect();
        return !(vizDim.top > parentDim.bottom ||
            vizDim.bottom < parentDim.top ||
            vizDim.left > parentDim.right ||
            vizDim.right < parentDim.left);
    }

    /**
     * Renders a visualisation by plotting the measurements. Only render if
     * it is not already rendered.
     *
     * @param {Object} vizContainer Visualisation container DOM node.
     */
    function renderVisualisation(vizContainer) {
        if (vizContainer.isRendered)
            return;
        var gid = vizContainer.gene,
            sid = vizContainer.strain,
            cid = vizContainer.centre,
            lid = vizContainer.pipeline,
            peid = vizContainer.procedure,
            qeid = vizContainer.parameter,
            geneId = prepareGeneStrainCentrePipelineId(gid, sid, cid, lid);
        selectedDatapoints.reset();
        plotParameter('viz-' + geneId + "-" + qeid +
            "-" + vizContainer.index, vizContainer, gid, sid, cid, lid, peid, qeid);
        vizContainer.isRendered = true;
    }

    /**
     * Refresh all of the visualisations in the visualisation cluster.
     *
     * @param {Boolean} forced If true, the visualisation will be re-rendered.
     */
    function refreshVisualisationCluster(forced) {
        var i, c = visualisationCluster.length,
            vizContainer, clusterNode, isVisible;
        if (c > 0) {
            clusterNode = d3.select('#cluster');
            for (i = 0; i < c; ++i) {
                vizContainer = visualisationCluster[i];
                vizContainer.isVisible = isVisible =
                    isVisualisationVisible(vizContainer, clusterNode);
                if (forced || !isVisible) {
                    vizContainer.isRendered = false;
                    clear(vizContainer);
                    vizContainer.classed('loading', true);
                }
                if (isVisible)
                    renderVisualisation(vizContainer);
            }
        }
    }

    function showUIFramework(container) {
        var content;
        clear(container);
        content = addDiv(container, 'content');
        addDiv(container, 'sidebar');
        showVisualise(content);
        refreshVisualisationCluster();
        createInformationBox();
        citedDatapointsNotification =
            addDiv(content, 'cited-notification',
                null, "Loading cited datapoints...");
        hideCitedDatapointsNotification();
        window.onresize = resize;
    }

    /**
     * Determines the type of visualisation, and prepares the data for plotting.
     *
     * @param {Object} type Contains plot type, convertors and labels.
     * @param {String} selector DOM node selector of the visualisatin container.
     *
     * @return An array of values that can be used by the visualisation module.
     */
    dcc.visualise = function (type, selector) {
        var vizContainer = d3.select(selector);

        vizContainer.selectAll('svg').remove();
        vizContainer.selectAll('.vopt-controls').remove();

        if (type === null || type.t === 'noplot') {
            vizContainer.text('Unplottable data')
                .classed('no-visualisation', true);
        } else {
            if (type.t === 'meta') {
                vizContainer.text('Meta-data display is currently work-in-progress.')
                    .classed('no-visualisation', true);
            } else {
                vizContainer.text('').classed('no-visualisation', false);

                geneList.empty();
                geneList.append({
                    'cid': dcc.dataContext.cid,
                    'lid': dcc.dataContext.lid,
                    'gid': dcc.dataContext.gid,
                    'sid': dcc.dataContext.sid
                });

                parameterList.empty();
                parameterList.append({
                    'pid': dcc.dataContext.pid,
                    'peid': dcc.dataContext.peid,
                    'qid': dcc.dataContext.qid,
                    'qeid': dcc.dataContext.qeid
                });

                dcc.plotType = type;

                initZygosity();
                showUIFramework(vizContainer);
            }
        }
    };

    /**
     * Returns the population standard deviation of a column group with
     * the same x-axis key value.
     *
     * @param {Object} statistics The statistics object.
     * @param {Object} groupKey The key that was used to group data points
     *     into a column.
     */
    function getColumnStandardDeviation(statistics, groupKey) {
        var columnStatistics = statistics.c.c,
            indexInStatisticsTable = statistics.c.i[groupKey];
        return columnStatistics[indexInStatisticsTable].s.sd;
    }

    /**
     * Returns the standard error for a column group with the same x-axis
     * key value.
     *
     * @param {Object} statistics The statistics object.
     * @param {Object} groupKey The key that was used to group data points
     *     into a column.
     */
    function getColumnStandardError(statistics, groupKey) {
        var columnStatistics = statistics.c.c,
            indexInStatisticsTable = statistics.c.i[groupKey];
        return columnStatistics[indexInStatisticsTable].s.se;
    }


    function isMale(dataPoint) {
        return dataPoint.s === 1;
    }

    function filterByGender(temp, viz) {
        var datum, i, l, data = [], showMale = viz.isActiveCtrl('male'),
            showFemale = viz.isActiveCtrl('female');

        if (showMale && showFemale)
            return temp;
        else {
            if (showMale)
                for (i = 0, l = temp.length; i < l; ++i) {
                    datum = temp[i];
                    if (isMale(datum))
                        data.push(datum);
                }
            else if (showFemale)
                for (i = 0, l = temp.length; i < l; ++i) {
                    datum = temp[i];
                    if (!isMale(datum))
                        data.push(datum);
                }
        }
        return data;
    }

    var Beeswarm = function (data, xaxis, radius) {
        this.data = data;
        this.xaxis = xaxis;
        this.radius = radius;
    };

    var scaledYComparator = getComparator('sy');
    Beeswarm.prototype = {
        swarm: function (leaning, bound) {
            var me = this, s = [], x = me.xaxis, v, ub, lb,
                r = me.radius, data = me.data, i, c = data.length;
            data.sort(scaledYComparator);
            ub = x + bound;
            lb = x - bound;
            for (i = 0; i < c; ++i) {
                v = get_x(i, data[i], s, x, r, leaning);
                if (v > ub)
                    v = ub;
                if (v < lb)
                    v = lb;
                data[i].sx = v;
            }
            return data;
        }
    };

    function find_intersections(circle, height) {
        var effective_height = height - circle.y,
            diameter = 2 * circle.radius;
        if (effective_height > diameter)
            return undefined;

        var cx = circle.x,
            x = Math.sqrt(diameter * diameter -
                effective_height * effective_height),
            index = circle.index;
        return {
            'p1': {
                'index': index,
                'isEnd': false,
                'isValid': true,
                'x': cx - x,
                'y': height
            },
            'p2': {
                'index': index,
                'isEnd': false,
                'isValid': true,
                'x': cx + x,
                'y': height
            }
        };
    }

    function find_candidate_intervals(height, swarm_boundary) {
        var i = 0, c = swarm_boundary.length, possible_intervals = [];
        while (c--) {
            var isects = find_intersections(swarm_boundary[i], height);
            if (isects === undefined) {
                swarm_boundary.splice(i, 1);
                continue;
            }
            possible_intervals.push(isects.p1);
            possible_intervals.push(isects.p2);
            ++i;
        }
        return possible_intervals;
    }

    var intervalComparator = getComparator('x', 'index');
    function remove_invalid_intervals(intervals) {
        var c = intervals.length, valid_intervals = [], start;
        if (c < 1)
            return valid_intervals;

        var i, j;
        intervals.sort(intervalComparator);
        for (i = 0; i < c; ++i) {
            start = intervals[i];
            if (start.isEnd)
                continue;
            for (j = i + 1; j < c; ++j) {
                if (start.index === intervals[j].index) {
                    intervals[j].isEnd = true;
                    break;
                } else
                    intervals[j].isValid = false;
            }
        }
        for (i = 0; i < c; ++i)
            if (intervals[i].isValid)
                valid_intervals.push(intervals[i]);
        return valid_intervals;
    }

    var distanceComparator = getComparator('d');
    function choose_x(intervals, xaxis, leaning) {
        var i, c = intervals.length, distance = [], x;
        for (i = 0; i < c; ++i) {
            x = intervals[i].x;
            if ((leaning === 'l' && x > xaxis) ||
                (leaning === 'r' && x < xaxis))
                continue;
            distance.push({
                'i': i,
                'd': Math.abs(xaxis - x)
            });
        }
        distance.sort(distanceComparator);
        return intervals[distance[0].i].x;
    }

    function get_x(index, datum, swarm_boundary, xaxis, radius, leaning) {
        var x, y = datum.sy,
            isects = find_candidate_intervals(y, swarm_boundary),
            preferred_choice = {
                'index': index,
                'isEnd': false,
                'isValid': true,
                'x': xaxis,
                'y': y
            };
        isects.push(preferred_choice);
        isects.push(preferred_choice);
        isects = remove_invalid_intervals(isects);
        x = choose_x(isects, xaxis, leaning);
        swarm_boundary.push({
            'index': index,
            'x': x,
            'y': y,
            'radius': radius
        });
        return x;
    }

    /**
     * Prepares the measurement identifiers for the selected data points so that
     * they can be communicated to the server.
     *
     * @returns An array of measurements identifiers.
     */
    function prepareSelectedDatapoints() {
        var measurementIdentifiers = [];
        selectedDatapoints.each(function (d) {
            measurementIdentifiers.push(d.m);
        });
        return measurementIdentifiers;
    }

    /**
     * Prepares animal ids for retrieving details.
     *
     * @returns {String} Comma separated list of animal ids.
     */
    function prepareSelectedAnimals() {
        var i, selectedAnimals = {}, animalIds = '';
        /* we only want unique animal ids, so hash them out */
        selectedDatapoints.each(function (d) {
            selectedAnimals[d.a] = 1;
        });
        /* if there were any media, include this */
        if (dcc.mediaContextForQC !== null)
            selectedAnimals[dcc.mediaContextForQC.aid] = 1;

        numberOfSelectedAnimals = 0;
        for (i in selectedAnimals) {
            animalIds += i + ',';
            ++numberOfSelectedAnimals;
        }
        return animalIds;
    }

    /**
     * Prepares animal details for inclusion in the description text area.
     *
     * @param {Array} animals Array of specimens.
     * @returns {String} Animal details to be filled in text area.
     */
    function prepareAnimalDetails(animals) {
        var i, animal, s = '\n\nANIMAL DETAILS:\n' +
            'Animal id, Animal name, Litter, Genotype, Cohort id\n';
        for (i in animals) {
            animal = animals[i];
            s += animal.animalId + ', ' +
                animal.animalName + ', ' +
                animal.litter + ', ' +
                animal.genotype + ', ' +
                animal.cohortId + '\n';
        }
        return s;
    }

    /**
     * Prepare measurement details for inclusion in the description text area.
     * 
     * @returns {String} Measurement details to be filled in text area.
     */
    function prepareMeasurementDetails() {
        var s = 'MEASUREMENT DETAILS:\nAnimal id, ',
            plotType = dcc.plotType;

        if (plotType.t === 'noplot') {
            return '';
        } else if (plotType.t === 'nominal') {
            s += 'Date, Value\n';
        } else {
            s += plotType.xl + ', ' + plotType.yl + '\n';
        }

        selectedDatapoints.each(function (datapoint) {
            var xy = measurementLookUpTable[datapoint.m];
            if (xy) {
                s += datapoint.a + ', ' + xy.x + ', ' + xy.y + '\n';
            }
        });
        return s;
    }

    /**
     * Displays the raise issue dialog. We firts retrieve details of all the
     * animals that were selected before the raise issue button was pressed.
     * This is then filled in the description text area.
     *
     * @param {Object} dialog The dialog box, so that it can be closed.
     * @param {String} autoDetails Details to put inside the
     *     description text area.
     */
    function showRaiseIssueDialog(dialog, autoDetails) {
        var formContainer = d3.select('#form-container'), textarea, label, c,
            failureMessage =
            'Failed to create issue due to database error...</br>' +
            '</br>Kindly notify PhenoDCC developers at ' +
            '<a href="mailto:developers@har.mrc.ac.uk">' +
            'developers@har.mrc.ac.uk</a>';

        formContainer.append('div')
            .attr('class', 'form-label')
            .text('Title:');

        formContainer.append('input')
            .attr('id', 'issue-title')
            .attr('type', 'text')
            .attr('name', 'title')
            .attr('placeholder', 'Enter here a brief title that summarises the issue')
            .attr('class', 'form-input-text');

        c = selectedDatapoints.getCount();
        if (c === 0 && dcc.mediaContextForQC !== null)
            c = 1;
        label = 'Description: <span style="color:' +
            (c > 0 ? 'green' : 'red') + '">(' + c + ' datapoints selected';
        if (c > 0)
            label += ' for ' + numberOfSelectedAnimals + ' specimens)</span>';
        else
            label += ')</span>';
        formContainer.append('div')
            .attr('class', 'form-label')
            .html(label);

        textarea = formContainer.append('textarea')
            .attr('id', 'issue-description')
            .attr('rows', 18)
            .attr('cols', 96)
            .attr('name', 'detail')
            .attr('placeholder', 'Provide here a detail description of the issue.')
            .attr('class', 'form-textarea');
        if (autoDetails !== undefined)
            textarea.html(autoDetails);

        var buttonGroup = formContainer.append('div')
            .attr('class', 'form-button-group');

        buttonGroup.append('div')
            .attr('class', 'form-label')
            .text('Priority:');

        buttonGroup.append('select')
            .attr('id', 'issue-priority')
            .attr('class', 'form-label')
            .html('<option value="1">Low</option>' +
                '<option value="2">Medium</option>' +
                '<option value="3">High</option>');

        buttonGroup.append('div')
            .attr('class', 'submit-button')
            .text('Submit issue')
            .on('click', function () {
                preventEventBubbling();
                var t = document.getElementById('issue-title').value,
                    d = document.getElementById('issue-description').value,
                    p = document.getElementById('issue-priority').value;
                buttonGroup.selectAll('*').remove();
                buttonGroup.attr('class', 'server-busy-creating-issue')
                    .text('Server is busy creating the issue... please wait');
                var issue = new Ext.create('PhenoDCC.model.Issue', {
                    "title": t,
                    "description": d,
                    "priority": p,
                    "controlSetting": dcc.visualisationControl,
                    "status": 0, /* cid for new in phenodcc_qc.issue_status */
                    "contextId": dcc.dataContext.id,
                    "lid": dcc.dataContext.lid,
                    "raisedBy": dcc.roles.uid,
                    "raisedByUid": dcc.roles.uid,
                    "assignedTo": 1,
                    "datapoints": prepareSelectedDatapoints()
                });
                issue.save({
                    callback: function (record, operation) {
                        dialog.close();
                        dcc.extjs.controller.onPipelineChange();
                        if (!operation.wasSuccessful()) {
                            Ext.MessageBox.show({
                                title: 'Failed to raise an issue',
                                msg: failureMessage,
                                buttons: Ext.MessageBox.OK,
                                icon: Ext.MessageBox.ERROR
                            });
                        }
                    }
                });
            });

        buttonGroup.append('div')
            .attr('class', 'cancel-button')
            .text('Cancel')
            .on('click', function () {
                dialog.close();
            });
    }

    dcc.isQcUser = function (msg) {
        var t = true;
        if (dcc.roles.uid === 0) {
            if (msg)
                alert('Sorry, you must be logged in to ' + msg);
            t = false;
        }
        if (dcc.roles.qc === false) {
            if (msg)
                alert('Sorry, you do not have privileges to ' + msg);
            t = false;
        }
        return t;
    };

    /**
     * Creates a dialog with form fields for raising an issue.
     */
    function renderRaiseIssueDialog() {
        var dialog = Ext.create('Ext.window.Window', {
            title: 'Raise an issue',
            height: 550,
            width: 750,
            modal: true,
            layout: 'fit',
            resizable: false,
            items: {
                xtype: 'container',
                border: false,
                bodyPadding: 15,
                html: '<div id="form-container"></div>'
            }
        }).show();

        if (typeof retrieveSelectedSpecimenDetailsRequest.abort === 'function')
            retrieveSelectedSpecimenDetailsRequest.abort();
        retrieveSelectedSpecimenDetailsRequest =
            d3.json("rest/specimens/extjs/selected"
                + '?u=' + dcc.roles.uid
                + '&s=' + dcc.roles.ssid
                + '&ids=' + prepareSelectedAnimals(),
                function (data) {
                    var s = '',
                        animalDetails = prepareAnimalDetails(data.specimens),
                        measurementDetails = prepareMeasurementDetails();
                    if (data.success === true && data.total > 0) {
                        if (animalDetails)
                            s = animalDetails;
                        if (measurementDetails)
                            s = s + "\n\n" + measurementDetails;
                    } else {
                        if (dcc.mediaContextForQC !== null)
                            s = 'Animal name: ' + dcc.mediaContextForQC.an;
                    }
                    showRaiseIssueDialog(dialog, s);
                });
    }

    function maximiseVisualisation() {
        var a = Ext.getCmp('data-view-specimens-qc-panel'),
            b = Ext.getCmp('gene-strain-procedure-parameter-container'),
            bOn = function () {
                b.un('collapse', bOn);
            },
            aOn = function () {
                dcc.extjs.controller.attachResizeHandler();
                a.un('collapse', aOn);
                b.on('collapse', bOn);
                b.collapse();
            };
        if (!a.getCollapsed()) {
            if (!b.getCollapsed()) {
                a.on('collapse', aOn);
                dcc.extjs.controller.detachResizeHandler();
            }
            a.collapse();
        } else {
            if (!b.getCollapsed())
                b.collapse();
        }
    }

    function minimiseVisualisation() {
        var a = Ext.getCmp('data-view-specimens-qc-panel'),
            b = Ext.getCmp('gene-strain-procedure-parameter-container'),
            aOn = function () {
                a.un('expand', aOn);
            },
            bOn = function () {
                dcc.extjs.controller.attachResizeHandler();
                b.un('expand', bOn);
                a.on('expand', aOn);
                a.expand();
            };
        if (b.getCollapsed()) {
            if (a.getCollapsed()) {
                b.on('expand', bOn);
                dcc.extjs.controller.detachResizeHandler();
            }
            b.expand();
        } else {
            if (a.getCollapsed())
                a.expand();
        }
    }

    /**
     * Create a toolbar for controlling visualisation and raising issues.
     *
     * @param {Object} container D3 selected DOM node that contains the
     *     visualisation.
     */
    function renderButtonsPanel(container) {
        var buttonGroup = container.append('div')
            .attr('id', 'viz-control-buttons')
            .attr('class', 'button-group'),
            controller = dcc.extjs.controller;

        buttonGroup.append('div')
            .attr('class', 'viz-button-qcdone')
            .attr('title', 'Mark this as QC done')
            .on('click', function () {
                if (dcc.isQcUser('mark this context as QC done.')) {
                    d3.text('rest/datacontexts/qcdone/' + dcc.dataContext.id
                        + '?u=' + dcc.roles.uid + '&s=' + dcc.roles.ssid)
                        .header("Content-type", "application/json")
                        .post(null,
                            function (error, text) {
                                dcc.dataContext.qid = -1;
                                dcc.dataContext.qeid = 'null';
                                controller.onPipelineChange();
                            });
                }
            });

        buttonGroup.append('div')
            .attr('class', 'viz-button-qcdonegrp')
            .attr('title', 'Mark related parameters as QC done')
            .on('click', function () {
                if (dcc.isQcUser('mark related parameters as QC done.')) {
                    d3.text('rest/datacontexts/qcdonegrp/' + dcc.dataContext.id
                        + '?u=' + dcc.roles.uid + '&s=' + dcc.roles.ssid)
                        .header("Content-type", "application/json")
                        .post(null,
                            function (error, text) {
                                controller.onPipelineChange();
                            });
                }
            });

        buttonGroup.append('div')
            .attr('class', 'viz-button-raise')
            .attr('title', 'Raise an issue with selected data points')
            .on('click', function () {
                if (dcc.isQcUser('raise an issue.'))
                    renderRaiseIssueDialog();
            });

        buttonGroup.append('div')
            .attr('class', 'viz-button-clear')
            .attr('title', 'Clear data point selection')
            .on('click', function () {
                selectedDatapoints.reset();
                refreshVisibleVisualisations();
            }).append('div')
            .attr('id', 'num-selected-datapoints')
            .text(selectedDatapoints.count);

        buttonGroup.append('div')
            .attr('class', 'viz-button-maximise')
            .attr('title', 'Maximise visualisation')
            .on('click', maximiseVisualisation);

        buttonGroup.append('div')
            .attr('class', 'viz-button-minimise')
            .attr('title', 'Minimise visualisation')
            .on('click', minimiseVisualisation);
    }

    function getWindowX(event) {
        return event.pageX !== undefined
            ? event.pageX : event.clientX;
    }

    function getWindowY(event) {
        return event.pageY !== undefined
            ? event.pageY : event.clientY;
    }

    function getEvent(event) {
        if (!event)
            event = window.event;
        return event;
    }

    function Popup(parent) {
        this.parent = parent;
        this.init();
    }

    Popup.prototype = {
        init: function () {
            var me = this,
                popup = me.parent.append('div')
                .attr('class', 'timeline-popup')
                .style('visibility', 'hidden');
            me.popup = popup;
        },
        update: function (content) {
            var me = this;
            me.popup.html(content);
        },
        show: function () {
            var me = this;
            me.popup.style('visibility', 'visible');
        },
        hide: function () {
            var me = this;
            me.popup.style('visibility', 'hidden');
        },
        move: function (event) {
            var me = this, displacement = 6;
            event = getEvent(event);
            me.popup.style('left', getWindowX(event) + displacement + 'px');
            me.popup.style('top', getWindowY(event) + displacement + 'px');
        }
    };

    dcc.timeline = function (history, container) {
        var data = [], key, entry, timeline, popup, dataHasChanged = false,
            container = d3.select(container);
        container.select('table').remove();
        if (history === null)
            return;
        timeline = container.append('table');
        for (key in history) {
            entry = history[key];

            /* we wish to know if the data has changed since the last
             * time the context was marked as QC done. We are traversing
             * the history events from past to present. */
            switch (entry.t) {
                case 'qcdone':
                    dcc.lastQcDone = new Date(entry.w);

                    /* assume that data hasn't changed since this QC done */
                    dataHasChanged = false;
                    break;
                case 'adddata':
                case 'removedata':
                case 'changedata':
                    /* wrong assumption, data has changed since the last QC
                     * done, if any */
                    dataHasChanged = true;
                    break;
            }
            data.push({
                'user': entry.u,
                'when': new Date(entry.w),
                'type': entry.t,
                'state': entry.s,
                'issue': entry.r,
                'action': entry.a
            });
        }

        /* we only wish to highlight data points that was added or modified
         * since the last QC done. So, if there was no change, unset this so
         * that no data points are highlighted when 'New button' is enabled. */
        if (!dataHasChanged)
            dcc.lastQcDone = undefined;

        popup = new Popup(timeline);
        drawLabels(timeline, data, -1, 'user');
        drawMarkers(timeline, data, -1, popup);
        drawLabels(timeline, data, -1, 'when');
    };

    function drawLabels(timeline, data, inc, type) {
        var count = data.length, start = inc > 0 ? 0 : count - 1,
            cls = 'timeline-' + type,
            tr = timeline.append('tr').attr('class', cls);
        tr.append('td');
        while (count--) {
            tr.append('td').attr('class', cls).text(data[start][type]);
            start += inc;
        }
    }

    function drawMarkers(timeline, data, inc, popup) {
        var count = data.length, currentDate = null,
            start = inc > 0 ? 0 : count - 1,
            tr = timeline.append('tr').attr('class', 'marker');
        tr.append('td').append('div').attr('class', 'project-end').text('Now');
        while (count--) {
            currentDate = drawMarker(tr, data[start], currentDate, popup);
            start += inc;
        }
        tr.append('td').append('div').attr('class', 'project-start').text('Before data');
    }

    function getMarkerOnClickHandler(issue) {
        var controller = dcc.extjs.controller,
            tab = controller.getIssueSpecimenHistoryTab();
        return function () {
            dcc.dataContext.iid = issue;
            controller.loadIssues();
            tab.setActiveTab(0);
        };
    }

    function getActionType(entry) {
        switch (entry.type) {
            case 'adddata':
                return 'Added measurements';
            case 'removedata':
                return 'Removed measurements';
            case 'changedata':
                return 'Modified measurements';
            case 'raise':
                return 'Raised new issue';
            case 'comment':
                return 'Commented on issue';
            case 'accept':
                return 'Working on a fix for issue';
            case 'resolve':
                return 'Resolved issue';
            case 'qcdone':
                return 'Finished quality control';
            default:
                return 'Unknown action!';
        }
    }
    function getMarkerOnMouseOverHandler(entry, popup) {
        var controller = dcc.extjs.controller,
            store = controller.getIssuesStore();
        return function () {
            var msg = '<span class="timeline-popup-title">'
                + getActionType(entry) + '</span>', record, issue;
            if (entry.issue !== -1) {
                msg += '<p>';
                issue = entry.issue;
                record = store.findRecord('id', issue);
                if (record === null)
                    msg += 'Issue ' + issue + ' does not have a title!';
                else
                    msg += record.get('title');
                msg += '</p>';
            }
            popup.update(msg);
            popup.show();
        };
    }

    function drawMarker(tr, entry, currentDate, popup) {
        var date = entry.when, actionDate = date.getFullYear(), cls, marker;

        if (currentDate === null)
            currentDate = actionDate;
        else {
            if (currentDate !== actionDate) {
                cls = "new-year";
                currentDate = actionDate;
            }
        }
        marker = tr.append('td').attr('class', cls)
            .append('div').attr('class', 'timeline-action-' + entry.type);

        marker.on('mouseover', getMarkerOnMouseOverHandler(entry, popup));
        marker.on('mouseout', function () {
            popup.hide();
        });
        marker.on('mousemove', function (event) {
            popup.move(event);
        });

        if (entry.issue !== -1)
            marker.on('click', getMarkerOnClickHandler(entry.issue));

        return currentDate;
    }
})();
