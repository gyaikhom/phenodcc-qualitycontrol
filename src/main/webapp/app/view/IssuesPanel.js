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
Ext.define('PhenoDCC.view.IssuesPanel', {
    extend: 'Ext.grid.Panel',
    alias: 'widget.issuespanel',
    title: "List of issues for current context",
    border: 0,
    requires: [ 'PhenoDCC.store.Issues' ],
    store: 'Issues',
    viewConfig: {
        enableTextSelection: true,
        getRowClass: function(record, index, rowParams) {
            var status = record.get('status');
            return 'allissues-row-' + status;
        }
    },
    initComponent: function() {
        this.columns = [
        {
            text: "Status",
            dataIndex: "status",
            width: 70,
            sortable: true
        },
        {
            text: "Title",
            dataIndex: "title",
            flex: 1
        },
        {
            text: "Last update",
            dataIndex: "lastUpdate"
        },
        {
            text: "Raised By",
            dataIndex: "raisedBy"
        },
        {
            text: "Priority",
            dataIndex: "priority",
            width: 60,
            sortable: true
        }];
        this.callParent();
    }
});
