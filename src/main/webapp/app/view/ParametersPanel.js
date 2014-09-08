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
Ext.define('PhenoDCC.view.ParametersPanel', {
    extend: 'Ext.grid.Panel',
    alias: 'widget.parameterspanel',
    title: "Parameters",
    border: 0,
    requires: ['PhenoDCC.store.Parameters'],
    store: 'Parameters',
    viewConfig: {
        enableTextSelection: true
    },
    initComponent: function() {
        this.columns = [{
                text: "IMPReSS Id",
                dataIndex: 'e',
                width: 140,
                sortable: true,
                renderer: function(stateId, metaData, record) {
                    var key = record.get('e');
                    return record.get("r") ? '<span class="required">'
                        + key + '</span>' : key;
                }
            },
            {
                text: "Status",
                dataIndex: 'q',
                width: 50,
                sortable: true,
                renderer: function(stateId, metaData, record) {
                    return dcc.getStateIcon(stateId, metaData, record, true);
                }
            },
            {
                text: "Name",
                dataIndex: 'n',
                flex: 1,
                sortable: true
            },
            {
                text: "&#9888;",
                dataIndex: 'ur',
                width: 32,
                sortable: true
            },
            {
                text: "QC Max",
                dataIndex: 'qM',
                width: 80,
                sortable: true,
                hidden: true
            },
            {
                text: "QC Min",
                dataIndex: 'qm',
                width: 80,
                sortable: true,
                hidden: true
            }];
        this.callParent();
    }
});
