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
Ext.define('PhenoDCC.view.QualityControl', {
    extend: 'Ext.container.Container',
    title: 'View phenotype data',
    alias: 'widget.qualitycontrol',
    requires: [
    'PhenoDCC.view.DataVisualisation',
    'PhenoDCC.view.GeneStrainsTree',
    'PhenoDCC.view.ProceduresPanel',
    'PhenoDCC.view.ParametersPanel'
    ],
    layout: 'border',
    border: 0,
    items: [
    {
        xtype: 'panel',
        title: 'Centre, Genes, Strains, Procedures and Parameters',
        id: 'gene-strain-procedure-parameter-container',
        region: 'west',
        width: 380,
        layout: 'border',
        split: true,
        collapsible: true,
        animCollapse: false,
        border: 0,
        items: [
        {
            xtype: 'combobox',
            id: 'data-view-centre-dropdown',
            region: 'north',
            fieldLabel: 'Centre',
            labelWidth: 50,
            emptyText:'Select a centre...',
            store: 'Centres',
            displayField: 'f',
            valueField: 'i',
            editable: false,
            padding: '10 4 0 5',
            listConfig: {
                getInnerTpl: function() {
                    return '<div>{s} : {f}</div>';
                }
            }
        },
        {
            xtype: 'combobox',
            id: 'data-view-pipeline-dropdown',
            region: 'north',
            fieldLabel: 'Pipeline',
            labelWidth: 50,
            emptyText:'Select a pipeline...',
            store: 'Pipelines',
            displayField: 'n',
            valueField: 'i',
            editable: false,
            padding: '5 4 15 5',
            listConfig: {
                getInnerTpl: function() {
                    return '<div>{k} : {n}</div>';
                }
            }
        },
        {
            xtype: 'tabpanel',
            id: 'gene-strain-procedure-parameter',
            region: 'center',
            tabPosition: 'top',
            border: 0,
            plain: true,
            bodyStyle: 'border:0px;',
            items: [
            {
                xtype: 'panel',
                title: 'Genes and Strains',
                layout: 'border',
                border: 0,
                padding: 5,
                items: [
                {
                    xtype: 'genestrainstree',
                    id: 'data-view-genestrains-tree',
                    region: 'center',
                    border: 1,
                    bodyCls: 'phenodcc-gene-tree'
                }
                ]
            },
            {
                xtype: 'panel',
                title: 'Procedures and Parameters',
                layout: 'border',
                border: 0,
                items: [
                {
                    xtype: 'procedurespanel',
                    id: 'data-view-procedures-panel',
                    region: 'north',
                    height: '50%',
                    split: true
                },
                {
                    xtype: 'parameterspanel',
                    id : 'data-view-parameters-panel',
                    region: 'center'
                }
                ]
            }]
        },
        {
            xtype: 'panel',
            id: 'data-view-gene-allele-strain-details',
            region: 'south',
            height: 200,
            padding: '4 4 4 4',
            bodyCls: 'phenodcc-gene-details'
        }
        ]
    },
    {
        xtype: 'datavisualisation',
        region: 'center',
        layout: 'fit',
        flex: 1
    }
    ]
});
