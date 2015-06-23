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
package org.mousephenotype.dcc.qualitycontrol.webservice;

import java.util.Iterator;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.qc.AUser;
import org.mousephenotype.dcc.entities.qc.HistoryEntry;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.HistoryPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("history")
public class HistoryFacadeREST extends AbstractFacade<HistoryEntry> {

    public HistoryFacadeREST() {
        super(HistoryEntry.class);
    }

    @GET
    @Path("{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public HistoryPack extjsFind(
            @PathParam("id") Long contextId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        HistoryPack p = new HistoryPack();
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            EntityManager drupalEm = getDrupalEntityManager();
            TypedQuery<HistoryEntry> q = em.createNamedQuery(
                    "History.findByContextId", HistoryEntry.class);
            q.setParameter("contextId", contextId);
            List<HistoryEntry> temp = q.getResultList();
            Iterator<HistoryEntry> i = temp.iterator();
            while (i.hasNext()) {
                HistoryEntry h = i.next();
                AUser actionedBy = drupalEm.find(AUser.class, h.getActionedBy());
                String user;
                if (h.getActionedBy() == -1) {
                    user = "Crawler";
                } else {
                    user = actionedBy == null
                            ? "Unknown" : actionedBy.toString();
                }
                h.setUser(user);
            }
            p.setDataSet(temp);
            em.close();
            drupalEm.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
