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
Ext.define('PhenoDCC.view.ProcedureSpecimens', {
    extend: 'Ext.grid.Panel',
    alias: 'widget.procedurespecimens',
    border: 0,
    requires: 'PhenoDCC.store.ProcedureSpecimens',
    store: 'ProcedureSpecimens',
    viewConfig: {
        enableTextSelection: true
    },
    initComponent: function() {
        this.columns = [
            {
                text: "Specimen details",
                columns: [
                    {
                        text: 'Animal id',
                        dataIndex: 'ai',
                        align: 'right',
                        sortable: true,
                        hidden: true,
                        width: 80
                    },
                    {
                        text: 'Litter',
                        dataIndex: 'l',
                        sortable: true,
                        align: 'right',
                        width: 80
                    },
                    {
                        text: "Name",
                        dataIndex: 'n',
                        sortable: true,
                        width: 200
                    },
                    {
                        text: "DOB",
                        dataIndex: 'd',
                        sortable: true,
                        width: 120,
                        renderer: Ext.util.Format.dateRenderer('Y/m/d M D')
                    },
                    {
                        text: "Sex",
                        dataIndex: 's',
                        sortable: true,
                        align: 'right',
                        width: 60,
                        renderer: function(value) {
                            return value ? 'Male' : 'Female';
                        }
                    },
                    {
                        text: "Zygosity",
                        dataIndex: 'z',
                        sortable: true,
                        renderer: function(value) {
                            switch (value) {
                                case 0:
                                    return 'Heterozygous';
                                case 1:
                                    return 'Homozygous';
                                case 2:
                                    return 'Hemizygous';
                                default:
                                    return 'Unknown';
                            }
                        }
                    },
                    {
                        text: "Litter",
                        dataIndex: 'l',
                        sortable: true,
                        hidden: true
                    },
                    {
                        text: "Pipeline",
                        dataIndex: 'p',
                        sortable: true,
                        hidden: true
                    }
                ]
            },
            {
                text: "Experiment details",
                columns: [
                    {
                        text: "Experimenter",
                        dataIndex: 'e',
                        align: 'right',
                        sortable: true
                    },
                    {
                        text: "Start data",
                        dataIndex: 'sd',
                        sortable: true,
                        width: 120,
                        renderer: Ext.util.Format.dateRenderer('Y/m/d M D')
                    }
                ]

            },
            {
                text: 'Equipment used',
                columns: [
                    {
                        text: "Name",
                        dataIndex: 'en',
                        sortable: true
                    },
                    {
                        text: "Model",
                        dataIndex: 'em',
                        width: 180,
                        sortable: true
                    },
                    {
                        text: "Manufacturer",
                        dataIndex: 'et',
                        width: 180,
                        sortable: true
                    }]
            }
        ];

        this.bbar = Ext.create('Ext.PagingToolbar', {
            id: 'procedure-specimens-pager',
            store: this.store,
            displayInfo: true,
            displayMsg: '{0} - {1} of {2}',
            emptyMsg: "No experimental data"
        });

        this.callParent();
    }
});
