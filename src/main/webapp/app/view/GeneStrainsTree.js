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
Ext.define('PhenoDCC.view.GeneStrainsTree', {
    extend: 'Ext.tree.Panel',
    alias: 'widget.genestrainstree',
    border: 0,
    rootVisible: false,
    useArrows: true,
    tbar:
    {
        xtype: 'textfield',
        id: 'data-view-gene-strain-allele-searchbox',
        emptyText: 'Search by mutant line or wildtype strain...',
        padding: '5 2 5 2',
        height: 25,
        fieldCls: 'phenodcc-searchbox',
        listeners: {
            afterrender: function() {
                var searchBox =
                    d3.select('#data-view-gene-strain-allele-searchbox');
                searchBox.append('div').attr('class', 'clear-searchbox')
                .on("click", function() {
                    Ext.getCmp('data-view-gene-strain-allele-searchbox')
                    .reset();
                });
            }
        }
    }
});
