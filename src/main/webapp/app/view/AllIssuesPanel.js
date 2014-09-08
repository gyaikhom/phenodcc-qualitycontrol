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

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
Ext.define('PhenoDCC.view.AllIssuesPanel', {
    extend: 'Ext.grid.Panel',
    alias: 'widget.allissuespanel',
    title: "List of quality control issues for selected centre",
    border: 0,
    requires: ['PhenoDCC.store.AllIssues'],
    store: 'AllIssues',
    cls: 'issues-grid',
    viewConfig: {
        enableTextSelection: true,
        getRowClass: function(record, index, rowParams) {
            var context = record.get('context'), cls;
            if (context.numMeasurements === 0)
                cls = 'nodata';
            else {
                cls = record.get('status');
            }
            return 'allissues-row-' + cls;
        }
    },
    initComponent: function() {
        this.columns = [
            {
                text: "Priority",
                dataIndex: "priority",
                width: 60
            },
            {
                text: "Status",
                dataIndex: "status",
                width: 90
            },
            {
                text: "Title",
                dataIndex: "title",
                flex: 3
            },
            {
                text: "Procedure",
                dataIndex: "procedure",
                flex: 2
            },
            {
                text: "Parameter",
                dataIndex: "parameter",
                flex: 2
            },
            {
                text: "Parameter key",
                dataIndex: "qeid",
                width: 160
            },
            {
                text: "Raised By",
                dataIndex: "raisedBy",
                flex: 1
            },
            {
                text: "Last update",
                dataIndex: "lastUpdate",
                flex: 1
            }];

        this.bbar = Ext.create('Ext.PagingToolbar', {
            id: 'allissues-pager',
            store: this.store,
            displayInfo: true,
            displayMsg: '{0} - {1} of {2}',
            emptyMsg: "No issues found for selected centre"
        });

        this.callParent();
    }
});
