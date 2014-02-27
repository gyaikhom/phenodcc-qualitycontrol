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
Ext.define('PhenoDCC.view.Viewport', {
    extend: 'Ext.container.Viewport',
    layout: 'fit',
    requires: [
        'PhenoDCC.view.QualityControl',
        'PhenoDCC.view.AllIssuesPanel'
    ],
    hidden: true,
    listeners: {
        afterrender: {
            fn: function() {
                var me = this;
                d3.select('#app-loading').remove();
                me.setVisible(true);
            }
        }
    },
    initComponent: function() {
        this.items = {
            dockedItems: [{
                    dock: 'top',
                    height: 34,
                    layout: 'border',
                    items: [
                        {
                            xtype: 'container',
                            id: 'logo',
                            html: "<img src='resources/images/logo-text.png' title='Version " + dcc.version + "'>",
                            width: 250,
                            region: 'west'
                        }, {
                            xtype: 'container',
                            id: 'maintoolbar',
                            region: 'center'
                        }
                    ]
                }],
            layout: 'fit',
            items: {
                xtype: 'container',
                layout: 'fit',
                plain: true,
                padding: '10 0 0 0',
                items:
                    {
                        xtype: 'tabpanel',
                        id: 'qc-summary-issues-tab',
                        region: 'center',
                        tabPosition: 'top',
                        border: 0,
                        plain: true,
                        bodyStyle: 'border:0px;',
                        items: [
                            {
                                xtype: 'qualitycontrol',
                                id: 'qc-main-content'
                            },
                            {
                                xtype: 'container',
                                id: 'all-issues-tab',
                                title: 'Summary of data and QC issues',
                                layout: 'fit',
                                items: {
                                    xtype: 'container',
                                    layout: 'border',
                                    items: [
                                        {
                                            xtype: 'form',
                                            id: 'all-issues-filter',
                                            region: 'north',
                                            height: '200',
                                            padding: 15,
                                            items: {
                                                xtype: 'checkboxgroup',
                                                fieldLabel: 'Issues to include',
                                                layout: 'hbox',
                                                listeners: {
                                                    change: function(field, newValue, oldValue, eOpts) {
                                                        dcc.allissuesFilter = 0x0;
                                                        for (var i in newValue)
                                                            dcc.allissuesFilter |= newValue[i];
                                                        Ext.getCmp('allissues-pager').moveFirst();
                                                        dcc.extjs.controller.loadAllIssues();
                                                    }
                                                },
                                                items: [
                                                    {
                                                        boxLabel: 'New',
                                                        name: 'new',
                                                        inputValue: 0x1,
                                                        checked: true,
                                                        id: 'issue-filter-new',
                                                        style: 'margin-left: 20px'
                                                    },
                                                    {
                                                        boxLabel: 'Accepted',
                                                        name: 'accepted',
                                                        inputValue: 0x2,
                                                        checked: true,
                                                        id: 'issue-filter-accepted',
                                                        style: 'margin-left: 20px'
                                                    },
                                                    {
                                                        boxLabel: 'Resolved',
                                                        name: 'resolved',
                                                        inputValue: 0x4,
                                                        checked: true,
                                                        id: 'issue-filter-resolved',
                                                        style: 'margin-left: 20px'
                                                    },
                                                    {
                                                        boxLabel: 'Data added',
                                                        name: 'dataadded',
                                                        inputValue: 0x8,
                                                        checked: true,
                                                        id: 'issue-filter-dataadded',
                                                        style: 'margin-left: 20px'
                                                    },
                                                    {
                                                        boxLabel: 'Data removed',
                                                        name: 'dataremoved',
                                                        inputValue: 0x10,
                                                        checked: true,
                                                        id: 'issue-filter-dataremoved',
                                                        style: 'margin-left: 20px'
                                                    },
                                                    {
                                                        boxLabel: 'Data changed',
                                                        name: 'datachanged',
                                                        inputValue: 0x20,
                                                        checked: true,
                                                        id: 'issue-filter-datachanged',
                                                        style: 'margin-left: 20px'
                                                    },
                                                    {
                                                        boxLabel: 'No measurements',
                                                        name: 'nodata',
                                                        inputValue: 0x40,
                                                        id: 'issue-filter-nodata',
                                                        style: 'margin-left: 20px'
                                                    }]
                                            }
                                        },
                                        {
                                            xtype: 'allissuespanel',
                                            id: 'all-issues-panel',
                                            region: 'center'
                                        }]
                                }
                            }]
                    }
            }
        };
        this.callParent();
    }
});
