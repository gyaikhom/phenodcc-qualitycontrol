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
                                xtype: 'panel',
                                title: "Specimen and experiment details",
                                layout: 'border',
                                border: 0,
                                items: [
                                    {
                                        xtype: 'form',
                                        region: 'north',
                                        items: {
                                            xtype: 'container',
                                            layout: 'border',
                                            border: 0,
                                            width: 500,
                                            height: 40,
                                            style: 'padding: 10px;',
                                            items: [
                                                {
                                                    xtype: 'textfield',
                                                    id: 'specimen-search-field',
                                                    fieldLabel: 'Search specimen',
                                                    region: 'center',
                                                    listeners: {
                                                        change: function (field, newValue, oldValue, eOpts) {
                                                            dcc.specimenNameQuery = newValue;
                                                            dcc.throttle(dcc.extjs.controller.searchForSpecimen, 500, dcc.extjs.controller);
                                                        }
                                                    }
                                                },
                                                {
                                                    xtype: 'button',
                                                    text: 'Clear',
                                                    region: 'east',
                                                    style: 'margin-left: 10px;',
                                                    handler: function () {
                                                        dcc.specimenNameQuery = '';
                                                        this.up('form').getForm().reset();
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        xtype: 'procedurespecimens',
                                        id: 'data-view-procedure-specimens-panel',
                                        region: 'center'
                                    }
                                ]
                            },
                            {
                                xtype: 'panel',
                                title: 'Metadata details',
                                id: 'data-view-metadata-panel'
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
