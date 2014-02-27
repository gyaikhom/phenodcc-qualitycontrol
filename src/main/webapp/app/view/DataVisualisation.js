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
Ext.define('PhenoDCC.view.DataVisualisation', {
    extend: 'Ext.panel.Panel',
    alias: 'widget.datavisualisation',
    requires: [
    'PhenoDCC.view.ProcedureSpecimens',
    'PhenoDCC.view.QcIssues'
    ],
    layout: 'fit',
    border: 0,
    initComponent: function() {
        this.items =
        {
            xtype: 'container',
            id: 'data-view-specimen-centric-tab',
            layout: 'border',
            items: [
            {
                xtype: 'container',
                region: 'center',
                layout: 'border',
                items:
                {
                    xtype: 'container',
                    id: 'specimen-centric-visualisation-container',
                    region: 'center',
                    style: 'background: #fff',
                    html: '<div id="specimen-centric-visualisation" style="height: 100%;"></div>',
                    disabled: true
                }
            },
            {
                xtype: 'tabpanel',
                title: 'Specimens and Quality Control Issues',
                id: 'data-view-specimens-qc-panel',
                region: 'south',
                height: '40%',
                split: true,
                collapsible: true,
                animCollapse: false,
                tabPosition: 'top',
                border: 0,
                plain: true,
                bodyStyle: 'border:0px;',
                items: [
                {
                    xtype: 'qcissues',
                    id: 'data-view-qc-issues'
                },
                {
                    xtype: 'procedurespecimens',
                    id: 'data-view-procedure-specimens-panel'
                },
                {
                    xtype: 'container',
                    title: 'History',
                    id: 'data-view-history-panel'
                }]
            }
            ]
        };
        this.callParent();
    }
});
