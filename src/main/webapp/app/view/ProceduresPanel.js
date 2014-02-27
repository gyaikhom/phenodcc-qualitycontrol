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
Ext.define('PhenoDCC.view.ProceduresPanel', {
    extend: 'Ext.grid.Panel',
    alias: 'widget.procedurespanel',
    title: "Procedures",
    border: 0,
    requires: [ 'PhenoDCC.store.Procedures' ],
    store: 'Procedures',
    viewConfig: {
        enableTextSelection: true
    },
    initComponent: function() {
        this.columns = [{
            text: "IMPReSS Id",
            dataIndex: 'e',
            width: 106,
            sortable: true
        },
        {
            text: "&#9881;",
            dataIndex: 's',
            width: 32,
            sortable: true,
            renderer: dcc.getStateIcon
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
        }];
        this.callParent();
    }
});
