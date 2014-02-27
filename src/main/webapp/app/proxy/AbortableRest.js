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
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
Ext.define('PhenoDCC.proxy.AbortableRest', {
    extend: 'Ext.data.proxy.Rest',
    alias: 'proxy.arest',
    
    /**
     * ExtJS 4.1 does not have an abort method to cancel specific request.
     * Since grid panel dependency (where the contents of one grid
     * depends on the selection of contents on another grid) means that
     * we should abort loading the dependent as soon as the selection on
     * the parent changes. This is especially important when the dependent
     * grid is currently being loaded while the selection was changed.
     * 
     * The proper way to handle such cases (especially when the network
     * connection is slow) is to abort any pending store loads, and replace
     * it with the new request. In this way, the grid associated with the
     * store will always load the latest as requested by the selection
     * change. To do this, we require the Ajax request, but since ExtJS
     * store does not provide an interface to retrieve this, we must
     * override the proxy doRequest() method so that the active request is
     * store in the proxy, in case we need it.
     */
    doRequest: function(operation, callback, scope) {
        var writer = this.getWriter(),
        request = this.buildRequest(operation, callback, scope);

        if (operation.allowWrite()) {
            request = writer.write(request);
        }

        Ext.apply(request, {
            headers : this.headers,
            timeout : this.timeout,
            scope : this,
            callback : this.createRequestCallback(request, operation, callback, scope),
            method : this.getMethod(request),
            disableCaching : false
        });

        this.lastRequest = Ext.Ajax.request(request);
        return request;
    },
    
    validateResponse: function (proxy, response) {	
        try {
            var responseData = proxy.reader.getResponseData(response);
            if (responseData.success === false) {
                /* note that negative of the total gives the error code */
                switch(responseData.total) {
                    case -401: /* session has expired */
                        window.location = "../user/login?destination=/qc";
                        break;
                }
            }
        } catch(err) {
            console.log(err);
        }
    },

    listeners: { 
        exception: function(proxy, response, options) {
            var me = this;
            me.validateResponse(proxy, response);
        }
    },
    
    afterRequest: function(request, success) {
        var me = this;
        me.validateResponse(request.scope, request.operation.response);
    }
});