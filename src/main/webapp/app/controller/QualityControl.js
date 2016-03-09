/*
 * Copyright 2012 Medical Research Council Harwell.
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

/* global d3, dcc, Ext */

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
Ext.define('PhenoDCC.controller.QualityControl', {
    extend: 'Ext.app.Controller',
    requires: [
        'Ext.window.MessageBox'
    ],
    refs: [
        {
            ref: 'centresDropdown',
            selector: '#data-view-centre-dropdown'
        },
        {
            ref: 'pipelinesDropdown',
            selector: '#data-view-pipeline-dropdown'
        },
        {
            ref: 'geneStrainsTree',
            selector: '#data-view-genestrains-tree'
        },
        {
            ref: 'geneStrainsSearchbox',
            selector: '#data-view-gene-strain-allele-searchbox'
        },
        {
            ref: 'geneAlleleStrainDetailsPanel',
            selector: '#data-view-gene-allele-strain-details'
        },
        {
            ref: 'proceduresPanel',
            selector: '#data-view-procedures-panel'
        },
        {
            ref: 'parametersPanel',
            selector: '#data-view-parameters-panel'
        },
        {
            ref: 'issuesPanel',
            selector: '#data-view-issues-panel'
        },
        {
            ref: 'issueMessagesPanel',
            selector: '#issue-messages-panel'
        },
        {
            ref: 'actionsPanel',
            selector: '#data-view-actions-panel'
        },
        {
            ref: 'procedureSpecimensPanel',
            selector: '#data-view-procedure-specimens-panel'
        },
        {
            ref: 'specimenCentricVisualisationContainer',
            selector: '#specimen-centric-visualisation-container'
        },
        {
            ref: 'geneStrainProcedureParameterTabpanel',
            selector: '#gene-strain-procedure-parameter'
        },
        {
            ref: 'issuesTabpanel',
            selector: '#data-view-qc-issues'
        },
        {
            ref: 'overallTab',
            selector: '#data-view-overall-tab'
        },
        {
            ref: 'specimenCentricTab',
            selector: '#data-view-specimen-centric-tab'
        },
        {
            ref: 'issueSpecimenHistoryTab',
            selector: '#data-view-specimens-qc-panel'
        },
        {
            ref: 'allIssuesTab',
            selector: '#all-issues-tab'
        },
        {
            ref: 'qcSummaryIssuesTabpanel',
            selector: '#qc-summary-issues-tab'
        },
        {
            ref: 'historyPanel',
            selector: '#data-view-history-panel'
        }
    ],
    stores: [
        'GeneStrains',
        'Centres',
        'Pipelines',
        'Procedures',
        'Parameters',
        'ProcedureSpecimens',
        'Measurements',
        'Issues',
        'AllIssues',
        'Actions',
        'DataContexts'
    ],
    /**
     * Function init() sets the handlers for events fired by the views.
     */
    init: function () {
        this.control(
            {
                '#data-view-centre-dropdown': {
                    change: this.onCentreSelect
                },
                '#data-view-pipeline-dropdown': {
                    change: this.onPipelineSelect
                },
                '#data-view-gene-strain-allele-searchbox': {
                    change: this.onGeneAlleleStrainSearch
                },
                '#data-view-genestrains-tree': {
                    selectionchange: this.onGeneAlleleSelectionChange,
                    itemclick: this.onGeneAlleleStrainSelect
                },
                '#data-view-procedures-panel': {
                    selectionchange: this.onProcedureSelect
                },
                '#data-view-parameters-panel': {
                    selectionchange: this.onParameterSelect
                },
                '#data-view-issues-panel': {
                    selectionchange: this.onIssueSelect
                },
                '#data-view-procedure-specimens-panel': {
                    selectionchange: this.onSpecimenSelect
                },
                '#data-view-overall-tab': {
                    activate: this.onOverallTabActivate
                },
                '#all-issues-tab': {
                    activate: function () {
                        if (!dcc.allIssuesAlreadyLoaded)
                            this.loadAllIssues();
                    }
                },
                '#all-issues-panel': {
                    selectionchange: this.setContextAndShowIssue
                },
                '#data-view-history-panel': {
                    activate: this.displayHistory
                }
            });

        this.application.on(
            {
                'centrechange': {
                    fn: 'onCentreChange',
                    scope: this
                },
                'pipelinechange': {
                    fn: 'onPipelineChange',
                    scope: this
                },
                'genotypechange': {
                    fn: 'onGenotypeChange',
                    scope: this
                },
                'strainchange': {
                    fn: 'onStrainChange',
                    scope: this
                },
                'procedurechange': {
                    fn: 'onProcedureChange',
                    scope: this
                },
                'parameterchange': {
                    fn: 'onParameterChange',
                    scope: this
                },
                'specimenchange': {
                    fn: 'onSpecimenChange',
                    scope: this
                }
            }
        );
    },
    ptype: {},
    setExtraParams: function (proxy) {
        if (proxy !== null) {
            proxy.extraParams.cid = dcc.dataContext.cid; /* centre */
            proxy.extraParams.lid = dcc.dataContext.lid; /* pipeline */
            proxy.extraParams.gid = dcc.dataContext.gid; /* genotype */
            proxy.extraParams.sid = dcc.dataContext.sid; /* strain */
            proxy.extraParams.pid = dcc.dataContext.pid; /* procedure id */
            proxy.extraParams.peid = dcc.dataContext.peid; /* procedure key */
            proxy.extraParams.qid = dcc.dataContext.qid; /* parameter id */
            proxy.extraParams.qeid = dcc.dataContext.qeid; /* parameter  key */
        }
        return proxy;
    },
    updateProcedureSpecimensProxy: function () {
        var me = this, store = me.getProcedureSpecimensStore();
        if (store !== null) {
            Ext.getCmp('procedure-specimens-pager').moveFirst();
            me.setExtraParams(store.getProxy());
        }
    },
    updateMeasurementsProxy: function () {
        var me = this, store = me.getMeasurementsStore(), proxy;
        if (store !== null) {
            proxy = me.setExtraParams(store.getProxy());
            if (proxy) {
                proxy.extraParams.ib = true; /* include wildtype data */
            }
        }
    },
    updateIssuesProxy: function () {
        var me = this, store = me.getIssuesStore(), proxy;
        if (store !== null) {
            proxy = store.getProxy();
            if (proxy)
                proxy.url = 'rest/issues/' + dcc.dataContext.id;
        }
    },
    updatePipelinesProxy: function () {
        var me = this, store = me.getPipelinesStore(), proxy;
        if (store) {
            proxy = store.getProxy();
            if (proxy)
                proxy.extraParams.cid = dcc.dataContext.cid;
        }
    },
    setCentre: function (cid) {
        dcc.dataContext.cid = cid;
        dcc.allIssuesAlreadyLoaded = null;
        this.application.fireEvent("centrechange");
    },
    setPipeline: function (lid) {
        dcc.dataContext.lid = lid;
        this.application.fireEvent("pipelinechange");
    },
    setGenotype: function (gid) {
        dcc.dataContext.gid = gid;
        this.application.fireEvent("genotypechange");
    },
    setStrain: function (sid) {
        dcc.dataContext.sid = sid;
        this.application.fireEvent("strainchange");
    },
    setProcedure: function (pid, peid) {
        dcc.dataContext.pid = pid;
        dcc.dataContext.peid = peid;
        this.application.fireEvent("procedurechange");
    },
    setContextId: function () {
        dcc.imageViewer = null;
        var me = this, store = me.getDataContextsStore();
        if (store !== null) {
            me.setExtraParams(store.getProxy());
            store.removeAll();
            store.load({
                callback: function () {
                    if (store.getCount() > 0) {
                        dcc.contextState = store.getAt(0);
                        dcc.dataContext.id = dcc.contextState.get('id');
                    } else {
                        dcc.dataContext.id = -1;
                    }
                    me.reloadIssues();
                    me.displayHistory();
                }
            });
        }
    },
    disableDependentPanels: function () {
        var me = this, actionsPanel = me.getActionsPanel(),
            vizContainer = d3.select("#specimen-centric-visualisation");
        me.clearPanel(me.getIssuesPanel());
        me.clearPanel(me.getProcedureSpecimensPanel());
        me.clearPanel(me.getParametersPanel());
        me.clearPanel(me.getProceduresPanel());

        if (actionsPanel)
            actionsPanel.update("");

        vizContainer.selectAll('div').remove();
    },
    onCentreChange: function () {
        var me = this;
        me.updatePipelinesProxy();
        me.loadPipelines();
    },
    onPipelineChange: function () {
        var me = this;
        me.disableDependentPanels();
        me.setContextId();
        me.loadGeneStrains();
    },
    onGenotypeChange: function () {
    },
    onStrainChange: function () {
        this.loadProcedures();
    },
    onProcedureChange: function () {
        var me = this;
        me.loadParameters();
        me.setContextId();
        me.reloadProcedureSpecimens();
        me.reloadIssues();
    },
    reloadProcedureSpecimens: function (tab) {
        if (tab === undefined) {
            tab = this.getSpecimenCentricTab();
        }
        if (tab.isVisible(true)) {
            this.updateProcedureSpecimensProxy();
            this.loadProcedureSpecimens();
        }
    },
    setContextAndShowIssue: function (selModel, selection) {
        if (selection !== null && selection.length > 0) {
            var me = this, tab, s = selection[0], context = s.get('context');
            tab = me.getQcSummaryIssuesTabpanel();
            tab.setActiveTab(0);
            tab = me.getIssueSpecimenHistoryTab();
            tab.setActiveTab(0);
            dcc.dataContext.lid = context.lid;
            dcc.dataContext.gid = context.gid;
            dcc.dataContext.sid = context.sid;
            dcc.dataContext.pid = context.pid;
            dcc.dataContext.qid = context.qid;
            dcc.dataContext.peid = s.get('peid');
            dcc.dataContext.qeid = s.get('qeid');
            dcc.dataContext.iid = s.get('id');
            me.loadPipelines();
        }
    },
    reloadIssues: function (tab) {
        var me = this;
        if (tab === undefined) {
            tab = me.getIssuesTabpanel();
        }

        var invalidContext = false, msg = "", context = dcc.dataContext;
        if (context.gid === -1) {
            if (msg.length > 0)
                msg += ', ';
            msg += "<i>genotype</i>";
            invalidContext = true;
        }
        if (context.sid === -1) {
            if (msg.length > 0)
                msg += ', ';
            msg += "<i>background strain</i>";
            invalidContext = true;
        }
        if (context.pid === -1) {
            if (msg.length > 0)
                msg += ', ';
            msg += "<i>procedure</i>";
            invalidContext = true;
        }
        if (context.qid === -1) {
            if (msg.length > 0)
                msg += ', ';
            msg += "<i>parameter</i>";
            invalidContext = true;
        }

        if (invalidContext) {
            var actionsPanel = me.getActionsPanel();
            if (actionsPanel) {
                actionsPanel.update(
                    '<div class="no-issues">Please select '
                    + msg
                    + ' to show QC issues in context.</div>');
            }
        } else {
            me.updateIssuesProxy();
            me.loadIssues();
        }
    },
    loadAllIssues: function () {
        var me = this, store = me.getAllIssuesStore(), proxy;
        if (store !== null) {
            proxy = store.getProxy();
            if (proxy !== null) {
                proxy.extraParams.cid = dcc.dataContext.cid;
                proxy.extraParams.filter = dcc.allissuesFilter;
                me.abortPending(store);
                store.load({
                    callback: function () {
                        dcc.allIssuesAlreadyLoaded = true;
                    },
                    scope: this
                });
            }
        }
    },
    setSpecimen: function (aid) {
        dcc.dataContext.aid = aid;
        this.application.fireEvent("specimenchange");
    },
    setParameter: function (qid, qeid) {
        dcc.dataContext.qid = qid;
        dcc.dataContext.qeid = qeid;
        this.application.fireEvent("parameterchange");
    },
    /**
     * The following functions are handlers for data context change events.
     */
    onSpecimenChange: function () {
    },
    onParameterChange: function () {
        var me = this, temp;
        me.setContextId();
        temp = me.getIssueMessagesPanel();
        temp.update('');
        me.reloadMeasurements();
        me.reloadIssues();
    },
    reloadMeasurements: function () {
        this.updateMeasurementsProxy();
        this.loadMeasurements();
    },
    /**
     * Function resetMeasurementsContex() resets the specimen identifier and
     * parameter identifiers (both internal database and EMPReSS Ids) in the
     * measurements context.
     */
    resetMeasurementsContext: function () {
        this.setParameter(-1, null);
        this.setSpecimen(-1);
    },
    /**
     * Function isValidDataContext() checks if the centre, genotype,
     * background strain and procedure Ids are valid.
     */
    isValidDataContext: function () {
        if (dcc.dataContext.cid < 0
            || dcc.dataContext.lid < 0
            || dcc.dataContext.gid < 0
            || dcc.dataContext.sid < 0
            || dcc.dataContext.pid < 0) {
            return false;
        } else {
            return true;
        }
    },
    /**
     * Function isValidMeasurementsContext() checks if the procedure
     * occurrence and EMPReSS parameter Ids are valid.
     */
    isValidMeasurementsContext: function () {
        if (dcc.dataContext.poid < 0
            || dcc.dataContext.qeid === null
            || dcc.dataContext.qeid.length === 0) {
            return false;
        } else {
            return true;
        }
    },
    /**
     * Function getFormattedDataContext() returns a formatted string that
     * can be used to display the data context.
     */
    getFormattedDataContext: function () {
        var s = 'cid: ' + dcc.dataContext.cid + ', ';
        s += 'lid: ' + dcc.dataContext.lid + ', ';
        s += 'gid: ' + dcc.dataContext.gid + ', ';
        s += 'sid: ' + dcc.dataContext.sid + ', ';
        s += 'pid: ' + dcc.dataContext.pid + ', ';
        s += 'peid: ' + dcc.dataContext.peid;
        return s;
    },
    /**
     * Function formatGeneDetail() retrieves gene related data from the store
     * and returns a formatted string. We use a data array rerieved from the
     * actual data store (see function selectStrain()) and the formatting
     * specification.
     */
    formatGeneDetail: function (data, props) {
        var detail =
            '<div id="phenodcc-gene-details-header">Gene details</div><br/>'
            + '<table id="phenodcc-gene-detail">';
        for (var i in props) {
            var value = data[props[i].field];
            detail += '<tr class="'
                + (i % 2 ? 'phenodcc-odd-row' : 'phenodcc-even-row')
                + '"><td class="phenodcc-label">'
                + props[i].label + '</td><td class="phenodcc-value">'
                + value + '</td></tr>';
        }
        return detail + "</table>";
    },
    formatGeneDetailsForPopup: function (data) {
        var props = [
            {
                label: 'MGI Id',
                field: 'geneId'
            },
            {
                label: 'Symbol',
                field: 'geneSymbol'
            },
            {
                label: 'Genotype',
                field: 'genotype'
            },
            {
                label: 'Strain',
                field: 'strain'
            }];

        dcc.gene_detail = '';
        for (var i in props) {
            dcc.gene_detail += '<li><b>' + props[i].label + ':</b> '
                + data[props[i].field] + '</li>';
        }
    },
    /**
     * Function selectStrain() selects a background strain from the gene/strain
     * tree panel. Note that the hierarchical tree displayed in the panel is not
     * linked directly to the genestrains store, which contains a lot of
     * information concerning genes and strains. Instead, for efficiency, we
     * generate a minimal tree store just for displaying the tree panel, and
     * use an index in the actual genestrains data store to dereference values.
     */
    selectStrain: function (ridx) {
        /* formatting specification to use in function formatGeneDetail() */
        var props = [
            {
                label: 'Id',
                field: 'geneId'
            },
            {
                label: 'Symbol',
                field: 'geneSymbol'
            },
            {
                label: 'Genotype',
                field: 'genotype'
            },
            {
                label: 'Strain',
                field: 'strain'
            },
            {
                label: 'Allele',
                field: 'alleleName'
            },
            {
                label: 'Name',
                field: 'geneName'
            }];

        /* retrieve the genotype and strain from the selection */
        var s = this.getGeneStrainsStore();
        var data = s.getAt(ridx).data;

        /* update data context */
        this.setGenotype(data.gid);
        this.setStrain(data.sid);

        /* update the details panel. */
        this.formatGeneDetailsForPopup(data);
        var detail = this.formatGeneDetail(data, props);
        var d = this.getGeneAlleleStrainDetailsPanel();
        if (!d.detailEl) {
            d.detailEl = d.body.createChild();
        }
        d.detailEl.hide().update(detail).slideIn('t', {
            duration: 200
        });

        d3.select('#context-details-genesymbol').text(data['geneSymbol']);
        d3.select('#context-details-genotype').text(data['genotype']);
        d3.select('#context-details-allele').html(data['alleleName']);
        d3.select('#context-details-strain').text(data['strain']);
    },
    /**
     * Function onGeneAlleleStrainSelect() is an event handler which is
     * invoked when a background strain is selected from the gene/strain tree,
     */
    onGeneAlleleStrainSelect: function (view, node) {
        if (!node.isLeaf()) {
            this.setDefaultDetail();
            if (node.isExpandable()) {
                view.toggle(node);
            }
        }
    },
    /**
     * Event handler when selection changes on the tree panel.
     */
    onGeneAlleleSelectionChange: function (view, selection) {
        if (selection !== null && selection.length) {
            var ridx = selection[0].raw.ridx;
            if (ridx !== undefined) {
                /* pass the tree panel index to dereference actual store */
                this.selectStrain(ridx);

                /* load the procedure-specimen data */
                this.loadProcedureSpecimens();
            }
        }
    },
    clearGeneContextDetails: function () {
        d3.select('#context-details-genesymbol').text('');
        d3.select('#context-details-genotype').text('');
        d3.select('#context-details-allele').html('');
        d3.select('#context-details-strain').text('');
    },
    /**
     * Function updateDetail() updates the content of the gene details panel.
     */
    updateDetails: function (content) {
        var d = this.getGeneAlleleStrainDetailsPanel();
        if (!d.detailEl) {
            d.detailEl = d.body.createChild();
        }
        d.detailEl.update("<div class='select-gene-for-details'>" + content + "</div>");
    },
    setDefaultDetail: function () {
        this.clearGeneContextDetails();
        this.updateDetails("Select a background strain to get additional details.");
    },
    setEmptyTree: function () {
        this.clearGeneContextDetails();
        this.updateDetails("Did not find genotype/background strain with data for the selected centre and pipeline.");
    },
    /**
     * Function combineGeneSymbolAndAllele() combines the gene symbol and the
     * allele identifier to a formatted string that will be used in the genes
     * and strains tree panel as node labels.
     */
    combineGeneSymbolAndAllele: function (item) {
        var allele = item.data.alleleName;
        if (allele && allele.length > 0)
            return allele.replace('<sup>', ' : <span class="allele-name">')
                .replace('</sup>', '</span>');
        else
            return item.data.geneSymbol;
    },
    regexEscape: function (str) {
        var specials = new RegExp("[.*+?|()\\[\\]{}\\\\]", "g");
        return str.replace(specials, "\\$&");
    },
    /**
     * Function onGeneAlleleStrainSearch() is an event handler which is invoked
     * when the value of the gene allele search box is altered. The new text
     * value is used as the search term to filter the store which is bound to
     * the genes and alleles tree panel. Since genes and alleles are less likely
     * to change, we do not reload the data using web services. Instead, we
     * utilise the data which is alrady available. This makes the search faster.
     * The plan is to peiodically update this store in the background, or to
     * load the data when requested explicitly by the user.
     */
    onGeneAlleleStrainSearch: function (t, newValue, oldValue, eOpts) {
        var me = this, expand = false, /* should we expand the tree hierarchy? */
            s = me.getGeneStrainsStore(); /* store to filter */
        me.setDefaultDetail(); /* no item selected, remove existing detail */
        s.clearFilter(); /* remove existing filters */
        if (newValue === '') {
            /* no filtering required, since all records must be displayed */
        } else {
            /* Apply a filter that matches the key against the gene symbol,
             * or the name of the background strain.
             */
            var pattern = new RegExp(me.regexEscape(newValue), 'i');
            s.filterBy(function (item) {
                return pattern.test(item.data.geneSymbol)
                    || pattern.test(item.data.strain);
            });

            /* filter key might match strains, which are children of alleles.
             * Hence, we must expand the tree hierarchy so that it is visible.
             * Especially, where the filter key does not match the allele name,
             * but matches the strain.
             */
            expand = true;
        }

        /* We now have the filtered records. Build the hierarchical tree from
         * this linear record. We use all of the available records.
         */
        var tree = me.createTree(s.getRange());

        /* We now have the tree, so update the tree panel with the new
         * hierarchical tree data structure.
         */
        var panel = me.getGeneStrainsTree(); /* tree panel to update */
        panel.setRootNode(tree);
        if (expand) {
            panel.expandAll();
        }
    },
    /**
     * Function createTree() generates a hierarchical tree data structure from
     * a list of genes and strains data. It utilises the grouping of the results
     * using the allele name.
     *
     * The hierarchical tree that we are creating has height 2. At depth 1 of
     * this tree, we store the gene using its allele name; at the leaves we
     * store the background strains.
     *
     * NOTE: The algorithm assumes that the records in the store are first
     * grouped using gene symbol and allele name. The web services delivering
     * the data are required to generate the records as required. If the data
     * is not already grouped, use HashMap instead of Arrays.
     */
    createTree: function (records) {
        if (records === null) {
            return null;
        }
        var c = records.length, tree = {
            'text': 'Genes and strains',
            'children': []
        }, currentStrain = null, i = 0, aidx = -1;
        while (i < c) {
            var record = records[i], thisStrain = record.get('strain');
            if (!(dcc.hideQcTicked && record.get('stateId') === 1)) {
                if (currentStrain !== thisStrain) {
                    tree.children.push({
                        'text': thisStrain,
                        'iconCls': 'strain',
                        'children': []
                    });
                    currentStrain = thisStrain;
                    ++aidx;
                }
                tree.children[aidx].children.push({
                    'text': this.combineGeneSymbolAndAllele(record),
                    'leaf': true,
                    'iconCls': dcc.getStateIconName(record),
                    'ridx': i /* index to record in store */
                });
            }
            ++i; /* move to next record */
        }
        return tree;
    },
    /**
     * The store contains a flat record structure, from which we group genes
     * under the same strain. To find the index in the tree panel, we have to
     * count all of the strains until we find the correct record.
     */
    getGeneStrainTreeIndex: function (store) {
        var i, c, index = 0, sid = -1, record, found = false, firstUsable = -1,
            numLinesFoundForStrain = 0;
        for (i = 0, c = store.getCount(); i < c; ++i) {
            record = store.getAt(i);
            /* does this record correspond to the
             * beginning of a strain expander? */
            if (sid !== record.get('sid')) {
                if (sid === -1 || numLinesFoundForStrain > 0)
                    ++index; /* one tree expander found */
                sid = record.get('sid');
            }
            if (!(dcc.hideQcTicked && record.get('stateId') === 1)) {
                ++numLinesFoundForStrain;
                if (firstUsable === -1) {
                    firstUsable = index;    
                }

                /* have we found the right genotype and strain? */
                if ((sid === dcc.dataContext.sid
                    && record.get('gid') === dcc.dataContext.gid)) {
                    found = true;
                    break;
                }
                ++index;
            }
        }
        if (!found)
            index = firstUsable;
        return index;
    },
    /**
     * Function showTree() first generates a hierarchical tree data structure
     * for a list of genes and strains information that has been grouped using
     * the allele name. This tree data structure is then used to initialise
     * the tree panel. Finally, the loading mask, which was enabled when the
     * data store was loaded using loadGeneStrains(), is disabled to mark that
     * the tree panel is ready for interaction.
     */
    showTree: function (records) {
        this.getGeneStrainProcedureParameterTabpanel().setActiveTab(0);

        var tree = this.createTree(records),
            treePanel = this.getGeneStrainsTree(),
            searchBox = this.getGeneStrainsSearchbox(),
            store = this.getGeneStrainsStore();

        searchBox.setValue("");
        treePanel.setRootNode(tree);
        if (tree === null) {
            this.setEmptyTree();
            searchBox.disable(true);
            store.removeAll(true);
        } else {
            searchBox.enable(true);
            treePanel.expandAll();
            var geneIndex = this.getGeneStrainTreeIndex(store);
            if (geneIndex === -1) {
                this.setDefaultDetail();
            } else {
                var selModel = treePanel.getSelectionModel();
                selModel.select(geneIndex);
            }
        }
        treePanel.setLoading(false);
    },
    /**
     * Function loadCentres() loads all of the active centres (or institutes)
     * that are providing phenotype data.
     */
    loadCentres: function () {
        var me = this;
        var store = me.getCentresStore();
        store.removeAll();
        store.load({
            callback: function () {
                var cdd = me.getCentresDropdown();
                if (store.getCount() > 0) {
                    var centreIndex = store.find('i', dcc.dataContext.cid);
                    if (centreIndex === -1) {
                        centreIndex = 0;
                    }
                    cdd.select(store.getAt(centreIndex));
                    cdd.enable(true);
                } else {
                    cdd.disable(true);
                }
            },
            scope: this
        });
    },
    loadPipelines: function () {
        var me = this;
        var store = me.getPipelinesStore();
        store.removeAll();
        store.load({
            callback: function () {
                var pdd = me.getPipelinesDropdown();
                if (store.getCount() > 0) {
                    var pipeline = store.find('i', dcc.dataContext.lid);
                    if (pipeline === -1) {
                        pipeline = 0;
                    }
                    pdd.reset();
                    pdd.select(store.getAt(pipeline));
                    pdd.enable(true);
                } else {
                    pdd.disable(true);
                }
            },
            scope: this
        });
    },
    /**
     * Function loadGeneStrains() initialises the genes and strains tree
     * panel by loading its contents through the web services. Existing
     * selections are discarded, and no default selection is made. The list
     * of genes and strains is filtered at the server using the centre
     * identifier. This function should, therefore, be invoked everytime the
     * centre selection changs in the centre drop-down menu.
     */
    loadGeneStrains: function () {
        var me = this;
        if (dcc.dataContext.cid < 0) {
            return;
        } else {
            var panel = me.getGeneStrainsTree();
            panel.setLoading(true, true);

            /* Note here that we do not use the store associated with the
             * tree panel because data in the tree store is derived from
             * the genestrains data store, which is managed separately from the
             * tree panel. This allows efficient tree hierarchy browsing and
             * searching inside the tree panel.
             */
            var store = me.getGeneStrainsStore();
            store.load({
                callback: me.showTree,
                scope: this,
                params: {
                    cid: dcc.dataContext.cid,
                    lid: dcc.dataContext.lid
                }
            });
        }
    },
    clearPanel: function (panel) {
        var store = panel.getStore();
        store.removeAll();
        return store;
    },
    findNextProcedure: function (store) {
        var next = store.findBy(function (record, id) {
            var stateId = record.get('s');
            /* exclude no data and qc done procedures */
            return stateId !== 0 && stateId !== 1;
        });

        /* if all procedures are QC done, select first with data */
        if (next === -1)
            next = store.findBy(function (record, id) {
                var stateId = record.get('s');
                return stateId !== 0;
            });

        /* if no procedure with data, select first record */
        if (next === -1)
            next = 0;
        return next;
    },
    findNextParameter: function (store) {
        var next = store.findBy(function (record, id) {
            var stateId = record.get('q');
            /* exclude no data and qc done parameters */
            return stateId !== 0 && stateId !== 1;
        });

        /* if all parameters are QC done, select first with data */
        if (next === -1)
            next = store.findBy(function (record, id) {
                var stateId = record.get('q');
                return stateId !== 0;
            });

        /* if no parameter with data, select first record */
        if (next === -1)
            next = 0;
        return next;
    },
    selectOrDisable: function (panel, contextId) {
        var me = this, returnValue = false;
        panel.setLoading(false);
        var store = panel.getStore();
        if (store.getCount() > 0) {
            var index;
            switch (contextId) {
                case 3: /* procedure */
                    index = store.find('i', dcc.dataContext.pid);
                    if (index === -1)
                        index = store.find('e', dcc.dataContext.peid);
                    if (index === -1)
                        index = me.findNextProcedure(store);
                    break;

                case 4: /* parameter */
                    index = store.find('id', dcc.dataContext.qid);
                    if (index === -1)
                        index = store.find('e', dcc.dataContext.qeid);
                    if (index === -1)
                        index = me.findNextParameter(store);
                    break;

                case 6: /* issue */
                    index = store.find('id', dcc.dataContext.iid);
                    if (index === -1)
                        index = 0;
                    break;

                default:
                    index = 0;
            }
            panel.enable(true);
            panel.getSelectionModel().select(index);
            returnValue = true;
        }
        return returnValue;
    },
    loadProcedures: function () {
        var me = this, p = me.getGeneStrainProcedureParameterTabpanel(),
            panel = me.getProceduresPanel(), store = me.clearPanel(panel);
        p.setActiveTab(1);
        me.abortPending(store);
        if (dcc.dataContext.lid < 0) {
            me.disablePanel(panel);
        } else {
            panel.setLoading(true, true);
            store.load({
                params: {
                    cid: dcc.dataContext.cid,
                    lid: dcc.dataContext.lid,
                    gid: dcc.dataContext.gid,
                    sid: dcc.dataContext.sid
                },
                callback: function () {
                    /* 3 means update procedure */
                    me.selectOrDisable(panel, 3);
                },
                scope: this
            });
        }
    },
    /**
     * Function abortPending() aborts all pending REST requests.
     */
    abortPending: function (store) {
        if (store.isLoading()) {
            Ext.Ajax.abort(store.getProxy().lastRequest);
        }
        store.removeAll();
    },
    /**
     * Function disablePanel() first hides the load mask (if any) and then
     * disables the panel.
     */
    disablePanel: function (panel) {
        panel.setLoading(false);
        panel.disable(true);
    },
    /**
     * Function loadParameters() loads the parameters into the store using
     * the arguments specified by the current data context.
     */
    loadParameters: function () {
        var me = this;
        var panel = me.getParametersPanel();
        var store = me.clearPanel(panel);
        me.abortPending(store);
        if (dcc.dataContext.pid < 0) {
            me.disablePanel(panel);
        } else {
            panel.setLoading(true, true);
            store.load({
                params: {
                    cid: dcc.dataContext.cid,
                    lid: dcc.dataContext.lid,
                    gid: dcc.dataContext.gid,
                    sid: dcc.dataContext.sid,
                    pid: dcc.dataContext.pid
                },
                callback: function () {
                    /* 4 means update parameter */
                    me.selectOrDisable(panel, 4);
                },
                scope: this
            });
        }
    },
    /* The procedure specimens tab contains a text field where users can
     * type part of the specimen name. This is used to filter out the
     * procedure/specimen list.
     */
    searchForSpecimen: function (animalId, handler) {
        var me = this, store = me.getProcedureSpecimensStore(), proxy;
        if (store !== null) {
            proxy = store.getProxy();
            if (proxy !== null) {
                if (animalId !== undefined) {
                    proxy.extraParams.n = '';
                    proxy.extraParams.a = animalId;
                } else {
                    proxy.extraParams.n = dcc.specimenNameQuery;
                    delete proxy.extraParams.a; // clear out animal id search
                }
                Ext.getCmp('procedure-specimens-pager').moveFirst();
                me.loadProcedureSpecimens(handler);
            }
        }
    },
    /* Filters procedure specimens to only display unique specimens. */
    showUniqueSpecimens: function (handler) {
        var me = this, store = me.getProcedureSpecimensStore(), proxy;
        if (store !== null) {
            proxy = store.getProxy();
            if (proxy !== null) {
                if (dcc.showUniqueSpecimens) {
                    proxy.extraParams.unique = true;
                } else {
                    delete proxy.extraParams.unique;
                }
                Ext.getCmp('procedure-specimens-pager').moveFirst();
                me.loadProcedureSpecimens(handler);
            }
        }
    },
    /**
     * Function loadProcedureSpecimen() loads all of the specimens on
     * which the procedure specified in the data context was applied. The
     * loaded details are displayed in the procedure-specimen panel which
     * contains specimen details, experiment details, and if any,
     * equipment information.
     * 
     * @param {Function} handler Additional handler to run if provided.
     */
    loadProcedureSpecimens: function (handler) {
        var me = this;
        var panel = me.getProcedureSpecimensPanel();
        var store = me.clearPanel(panel);
        me.abortPending(store);
        if (me.isValidDataContext()) {
            panel.setLoading(true, true);
            store.load({
                callback: function () {
                    /* 5 means update specimen identifier */
                    me.selectOrDisable(panel, 5);
                    
                    if (handler !== undefined)
                        handler();
                },
                scope: this
            });
        } else {
            me.disablePanel(panel);
        }
    },
    /**
     * Function disableChart() cleans the chart and disables it.
     */
    disableChart: function (chart) {
        chart.disable(true);
    },
    enableChart: function (chart) {
        chart.enable(true);
    },
    /**
     * Function loadMeasurements() loads all of the measurement values for
     * a specified parameter for a given specimen. We use the procedure
     * occurrence identifier (internal database identifier) to implicitly
     * identify the animal as it provides a link between measurements and
     * data context (e.g., genotype, strain etc.). The loaded details are
     * displayed in the measurements panel which contains incremnt, measured
     * values, and supplimentary data (e.g., mime type and URI if applicable).
     */
    loadMeasurements: function () {
        var me = this, chart = me.getSpecimenCentricVisualisationContainer(),
            node = d3.select('#specimen-centric-visualisation');
        node.selectAll('*').remove();
        if (me.isValidDataContext() && me.isValidMeasurementsContext()) {
            me.enableChart(chart);
            dcc.visualise(me.ptype, "#specimen-centric-visualisation");
        } else {
            me.disableChart(chart);
        }
    },
    /* Used by visualisation module to get measurements for specific id */
    getMeasurement: function (measurementId) {
        var me = this, index, store = me.getMeasurementsStore();
        store.clearFilter(true);
        index = store.findBy(function (record, id) {
            return record.get('m') === measurementId;
        });
        return store.getAt(index);
    },
    /**
     * Function loadIssues() initialises the issues list
     * by loading its contents through the web services. Existing selections
     * are discarded, and when loaded, the first item in the list is selected.
     */
    loadIssues: function () {
        var me = this;
        var panel = me.getIssuesPanel();
        var store = me.clearPanel(panel);
        me.abortPending(store);
        panel.setLoading(true, true);
        store.load({
            callback: function () {
                if (store.getCount() > 0) {
                    me.selectOrDisable(panel, 6);
                } else {
                    var viz = dcc.viz;
                    if (viz)
                        viz.state.q = {};
                    panel.setLoading(false);
                    var actionsPanel = me.getActionsPanel();
                    if (actionsPanel) {
                        actionsPanel.update('<div class="no-issues">Current data context does not have any Quality Control issues</div>');
                        d3.select('.create-new-action-button').remove();
                        dcc.dataContext.iid = null;
                    }
                }
            },
            scope: this
        });
    },
    /**
     * Function onProcedureSelect() is an event handler that is invoked
     * when a procedure is selected in the procedures list panel.
     */
    onProcedureSelect: function (selModel, selection) {
        if (selection !== null && selection.length > 0) {
            var s = selection[0];
            this.setProcedure(s.get('i'), s.get('e'));
            this.ptype.l = s.get('n'); /* prepare chart title */
        }
    },
    /**
     * Function onParameterSelect() is an event handler that is invoked
     * when a parameter is selected in the parameter list panel.
     */
    onParameterSelect: function (selModel, selection) {
        var me = this;
        if (selection !== null && selection.length > 0) {
            var s = selection[0], t = me.ptype.l;
            me.ptype = dcc.determinePlotType(s.getData());
            me.ptype.l = t;
            me.setParameter(s.get('i'), s.get('e'));
        }
    },
    onSpecimenSelect: function (selModel, selection) {
        if (selection !== null && selection.length > 0) {
            var animalId = selection[0].get('ai');
            this.setSpecimen(animalId);
            dcc.selectSpecimen(animalId);
        }
    },
    onCentreSelect: function (combo, centreId) {
        var node = d3.select('#context-details-centre');
        if (centreId === null)
            node.text('');
        else {
            node.text(combo.getRawValue());
            this.setCentre(centreId);
        }
    },
    onPipelineSelect: function (combo, pipelineId) {
        var node = d3.select('#context-details-pipeline');
        if (pipelineId === null)
            node.text('');
        else {
            node.text(combo.getRawValue());
            this.setPipeline(pipelineId);
        }
    },
    /* @TODO Should handle this properly using document fragments. */
    prepareActions: function (store, status) {
        var content = "<div id='actions-container'>", count = 0, text,
            markForInvestigation = false;

        store.each(function (record) {
            if (record.get('actionType') === 'accept')
                markForInvestigation = true;
            text = record.get('description')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/\n\n/g, "</p><br><p>")
                .replace(/\n/g, "</p><p>");
            content += "<div class='action-entry-" + (++count % 2 ? "odd" : "even") +
                "'><div class='action-title'>" +
                "<span class='actionedby'>" + record.get('actionedBy') + '</span>' +
                "<span class='actionedon'>" + record.get('lastUpdate') + '</span>' +
                "</div><div class='action-description'><p>" +
                text + "</p></div></div>";
        });

        content += '<div class="create-new-action">';
        if (status !== 'resolved') {
            content += '<textarea id="action-detail" class="form-textarea" ' +
                'rows=10 cols=80 placeholder="Provide details for one of the following actions.">' +
                '</textarea><div id="action-buttons" class="form-button-group">' +
                '<div id="add-comment" class="button">Add comment</div>';
            if (!markForInvestigation)
                content += '<div id="accept-issue" class="button">Mark as under investigation</div>';
            content += '<div id="resolve-issue" class="button">Mark as resolved</div>' +
                '</div><div></div>';
        }

        if (dcc.roles.uid === dcc.dataContext.raisedByUid) {
            content += '<div id="delete-issue" class="button">Delete issue</div></div><div></div>';
        }

        return content + "</div></div>";
    },
    deleteIssueHandler: function (issueId) {
        var me = this;
        d3.select('#delete-issue')
            .attr('title', 'Click here to delete this issue \nand related actions forever')
            .on('click', function () {
                if (dcc.isQcUser('delete this issue.')) {
                    if (dcc.roles.uid === dcc.dataContext.raisedByUid) {
                        if (window.confirm("Are you sure you wish to delete this issue?")) {
                            var d = document.getElementById('action-detail'),
                                action = new Ext.create('PhenoDCC.model.Action', {
                                    "description": 'Delete issue',
                                    "issueId": issueId,
                                    "actionedBy": dcc.roles.uid,
                                    "actionType": 11 /* cid for delete action in phenodcc_qc.action_type */
                                });
                            action.save({
                                callback: function () {
                                    me.onPipelineChange();
                                }
                            });
                        }
                    } else
                        alert('Sorry, issues can only be deleted by the user who raised it');
                }
            });
    },
    addCommentHandler: function (issueId) {
        var me = this;
        d3.select('#add-comment')
            .attr('title', 'Click here to leave the above text \nas a comment on this issue')
            .on('click', function () {
                if (dcc.isQcUser('comment on this issue.')) {
                    var d = document.getElementById('action-detail'),
                        action = new Ext.create('PhenoDCC.model.Action', {
                            "description": d.value,
                            "issueId": issueId,
                            "actionedBy": dcc.roles.uid,
                            "actionType": 1 /* cid for comment in phenodcc_qc.action_type */
                        });
                    action.save({
                        callback: function () {
                            me.onPipelineChange();
                        }
                    });
                }
            });
    },
    acceptIssueHandler: function (issueId) {
        var me = this;
        d3.select('#accept-issue')
            .attr('title', 'Click here to leave the above text as notification \nthat the issue is being looked at')
            .on('click', function () {
                if (dcc.isQcUser('mark this issue as accepted for investigation.')) {
                    var d = document.getElementById('action-detail').value,
                        action = new Ext.create('PhenoDCC.model.Action', {
                            "description": d ? d : 'Issue has been accepted for resolution.',
                            "issueId": issueId,
                            "actionedBy": dcc.roles.uid,
                            "actionType": 2, /* cid for accept in phenodcc_qc.action_type */
                            "lastUpdate": 0 /* doesn't matter: supplied by server */
                        });
                    action.save({
                        callback: function () {
                            me.onPipelineChange();
                        }
                    });
                }
            });
    },
    resolveIssueHandler: function (issueId) {
        var me = this;
        d3.select('#resolve-issue')
            .attr('title', 'Click here to mark this issue as resolved \nand leave the above text as description')
            .on('click', function () {
                if (dcc.isQcUser('resolve this issue.')) {
                    var d = document.getElementById('action-detail').value,
                        action = new Ext.create('PhenoDCC.model.Action', {
                            "description": d ? d : 'Issue is now resolved and closed.',
                            "issueId": issueId,
                            "actionedBy": dcc.roles.uid,
                            "actionType": 4, /* cid for resolve in phenodcc_qc.action_type */
                            "lastUpdate": 0 /* doesn't matter: supplied by server */
                        });
                    action.save({
                        callback: function () {
                            me.onPipelineChange();
                        }
                    });
                }
            });
    },
    displayIssueActions: function (issueId, status) {
        var me = this, actionsStore = me.getActionsStore(),
            parent = d3.select(d3.select('#data-view-actions-panel').node().parentNode);
        parent.select('.create-new-action-button').remove();
        if (actionsStore) {
            actionsStore.removeAll();
            var proxy = actionsStore.getProxy();
            if (proxy !== null) {
                proxy.extraParams.issueId = issueId;
                actionsStore.load({
                    callback: function () {
                        var actionsPanel = me.getActionsPanel();
                        if (actionsPanel) {
                            actionsPanel.update(me.prepareActions(actionsStore,
                                status));
                            if (status !== 'resolved') {
                                me.addCommentHandler(issueId);
                                me.acceptIssueHandler(issueId);
                                me.resolveIssueHandler(issueId);
                                parent.append('div')
                                    .attr('class', 'create-new-action-button')
                                    .text('+')
                                    .on('click', function () {
                                        d3.select('.create-new-action').node().scrollIntoView(true);
                                    });
                            }
                            me.deleteIssueHandler(issueId);
                        }
                    }
                });
            }
        }
    },
    onIssueSelect: function (selModel, selection) {
        var me = this;
        dcc.dataContext.raisedByUid = null;
        if (selection !== null && selection.length > 0) {
            var issue = selection[0];
            if (issue.get('status') !== 'resolved')
                dcc.visualisationControl = issue.get('controlSetting');
            dcc.showVisualisationControls();
            dcc.dataContext.raisedByUid = issue.get('raisedByUid');
            dcc.dataContext.iid = issue.get('id');
            me.displayIssueActions(issue.get('id'), issue.get('status'));
            dcc.loadCitedDatapoints();
        }
    },
    displayHistory: function () {
        if (dcc.dataContext.id === -1) {
            dcc.timeline(null, '#data-view-history-panel');
            this.getHistoryPanel().update('<div class="no-issues">Current data context does not yet have a history</div>');
        } else {
            this.getHistoryPanel().update();
            dcc.lastQcDone = undefined;
            d3.json('rest/history/' + dcc.dataContext.id
                + '?u=' + dcc.roles.uid
                + '&s=' + dcc.roles.ssid,
                function (data) {
                    dcc.timeline(data.history, '#data-view-history-panel');
                });
        }
    },
    /**
     * Generates a query string from the web application state.
     */
    stateToString: function () {
        var context = dcc.dataContext;
        return "cid=" + context.cid
            + "&gid=" + context.gid
            + "&sid=" + context.sid
            + "&lid=" + context.lid
            + "&pid=" + context.pid
            + "&qid=" + context.qid
            + "&peid=" + context.peid
            + "&qeid=" + context.qeid
            + "&ctrl=" + dcc.visualisationControl;
    },
    /**
     * Generates a bookmark link that contains centre, genotype, strain,
     * procedure and parameter information. This allows the web application
     * to start in a specific state.
     */
    showBookmark: function () {
        var bookmark = location.protocol + '//'
            + location.host
            + '/user/login?destination='
            + location.pathname
            + '?' + encodeURIComponent(this.stateToString()),
            win = window.open("", "Bookmark for PhenoDCC QC System State", "width=700,height=100");
        win.document.body.innerHTML = '<div style="font-family:Arial;font-size:14px;">'
            + '<p>Please use the following link to cite the current state of the QC system:</p>'
            + bookmark + '</div>';
        win.focus();
    },
    /**
     * Checks if the roles contains 'qc user' in it. Not very efficient,
     * but we can live with it. A bit map would be better.
     *
     * @param roles [String] An array of roles.
     */
    isQualityControlUser: function (roles) {
        var i, c = roles.length;
        for (i = 0; i < c; ++i) {
            if ('qc user' === roles[i]) {
                return true;
            }
        }
        return false;
    },
    attachResizeHandler: function () {
        var me = this, chart = me.getSpecimenCentricVisualisationContainer();
        chart.on('resize', dcc.loadMeasurements);
    },
    detachResizeHandler: function () {
        var me = this, chart = me.getSpecimenCentricVisualisationContainer();
        chart.un('resize', dcc.loadMeasurements);
    },
    /**
     * Function onLaunch() is invoked when the web application is loaded, after
     * the components have been initialised.
     */
    onLaunch: function () {
        var me = this, temp, contextDetails;

        dcc.loadMeasurements = function () {
            me.loadMeasurements();
        };
        me.attachResizeHandler();
        me.loadCentres();

        /* we maintain a reference to this controller for access from outside */
        dcc.extjs = {};
        dcc.extjs.controller = me;

        /* get the user roles */
        if (dcc.roles) {
            dcc.roles.qc = me.isQualityControlUser(dcc.roles.roles);
            dcc.roles.uid = Number(dcc.roles.uid);

            /* prepare toolbar */
            var context = dcc.dataContext, toolbar = '<div class="maintoolbar"><a id="reporting-link" href="../phenodcc-summary">Reporting</a><div class="separator"></div><a id="tracker-link" href="../tracker">Tracker</a><div class="separator"></div><a href="/impress" target="_blank">IMPReSS</a><div class="separator"></div><a href="manual.html" target="_blank">Help</a><div class="separator"></div><a id="bookmark-this">Bookmark</a></div>';
            if (dcc.roles.uid === 0) {
                toolbar += '<div class="user-loggedin"><span id="ctx-user">Not logged in</span><a id="login-link" href="../user/login?destination=/qc">log in</a></div>';
            } else {
                toolbar += '<div class="user-loggedin"><span id="ctx-user">' + dcc.roles.name + '</span><a href="../user/logout?current=user/' + dcc.roles.uid + '">sign out</a></div>';
            }
            temp = d3.select('#maintoolbar');
            temp.html(toolbar);

            /* for displaying gene selection details when visualisatin is maximised */
            contextDetails = temp.append('div').attr('id', 'context-details');
            contextDetails.append('div').attr('id', 'context-details-centre');
            contextDetails.append('div').attr('id', 'context-details-pipeline');
            contextDetails.append('div').attr('id', 'context-details-genotype');
            contextDetails.append('div').attr('id', 'context-details-allele');
            contextDetails.append('div').attr('id', 'context-details-strain');

            d3.select('#bookmark-this').on('click', function () {
                me.showBookmark();
            });
            d3.select('#tracker-link').on('click', function () {
                this.href = "../tracker?cid=" + context.cid;
            });
            d3.select('#login-link').on('click', function () {
                this.href = "../user/login?destination=/qc?"
                    + encodeURIComponent(me.stateToString());
            });
        }
    }
});
