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

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.NoResultException;
import javax.persistence.TypedQuery;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.overviews.ACentre;
import org.mousephenotype.dcc.entities.qc.AState;
import org.mousephenotype.dcc.entities.qc.AUser;
import org.mousephenotype.dcc.entities.qc.ActionType;
import org.mousephenotype.dcc.entities.qc.DataContext;
import org.mousephenotype.dcc.entities.qc.History;
import org.mousephenotype.dcc.entities.qc.HistoryEntry;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.DataContextHistoryPack;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.DataContextPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("datacontexts")
public class DataContextFacadeREST extends AbstractFacade<DataContext> {

    public DataContextFacadeREST() {
        super(DataContext.class);
    }

    private AState getState(String shortName, EntityManager em) {
        TypedQuery<AState> q = em.createNamedQuery("AState.findByShortName",
                AState.class);
        q.setMaxResults(1);
        q.setParameter("shortName", shortName);
        return q.getSingleResult();
    }

    private ActionType getActionType(String shortName, EntityManager em) {
        TypedQuery<ActionType> q = em.createNamedQuery(
                "ActionType.findByShortName", ActionType.class);
        q.setMaxResults(1);
        q.setParameter("shortName", shortName);
        return q.getSingleResult();
    }

    @POST
    @Path("qcdone/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    public void markAsQcDone(
            @PathParam("id") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        if (!isValidSession(sessionId, userId)) {
            return;
        }

        EntityManager em = getEntityManager();
        DataContext context = em.find(DataContext.class, id);
        AState state = getState("qcdone", em);
        ActionType actionType = getActionType("qcdone", em);
        markContextAsQcDone(context, state, actionType, userId, em);
        em.close();
    }

    private void markContextAsQcDone(
            DataContext context,
            AState state,
            ActionType actionType,
            Integer userId,
            EntityManager em) {
        if (context != null && state != null && actionType != null) {
            em.getTransaction().begin();
            context.setStateId(state);
            em.persist(new History(context, userId, actionType,
                    state, null, null));
            em.getTransaction().commit();
        }
    }

    @POST
    @Path("qcdonegrp/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    public void markParametersAsQcDone(
            @PathParam("id") Long contextId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        if (!isValidSession(sessionId, userId)) {
            return;
        }

        EntityManager em = getEntityManager();

        /* get the data context */
        DataContext context = em.find(DataContext.class, contextId);

        /* find all of the parameters under procedure defined by the context */
        TypedQuery<DataContext> q
                = em.createNamedQuery("DataContext.findByCidLidGidSidPid",
                        DataContext.class);
        q.setParameter("cid", context.getCid());
        q.setParameter("lid", context.getLid());
        q.setParameter("gid", context.getGid());
        q.setParameter("sid", context.getSid());
        q.setParameter("pid", context.getPid());

        /* mark them as QC done */
        try {
            AState state = getState("qcdone", em);
            ActionType actionType = getActionType("qcdone", em);

            List<DataContext> group = q.getResultList();
            Iterator<DataContext> i = group.iterator();
            while (i.hasNext()) {
                context = i.next();
                markContextAsQcDone(context, state, actionType, userId, em);
            }
        } catch (NoResultException e) {
        }
        em.close();
    }

    @GET
    @Path("extjs/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public DataContextPack extjsFind(
            @PathParam("id") Short id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        DataContextPack p = new DataContextPack();
        if (isValidSession(sessionId, userId)) {
            ArrayList<DataContext> t = new ArrayList<>();
            t.add(super.find(id));
            p.setDataSet(t);
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public DataContextPack extjsFindContext(
            @QueryParam("cid") Integer cid,
            @QueryParam("lid") Integer lid,
            @QueryParam("gid") Integer gid,
            @QueryParam("sid") Integer sid,
            @QueryParam("pid") Integer pid,
            @QueryParam("qid") Integer qid,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        DataContextPack p = new DataContextPack();
        if (isValidSession(sessionId, userId)) {
            p.setDataSet(null, 0L);
            if (cid > -1 && lid > -1 && gid > -1 && sid > -1
                    && pid > -1 && qid > -1) {
                EntityManager em = getEntityManager();
                ACentre centre = em.find(ACentre.class, cid);
                if (centre != null) {
                    TypedQuery<DataContext> query
                            = em.createNamedQuery("DataContext.findByContext",
                                    DataContext.class);
                    query.setParameter("cid", cid);
                    query.setParameter("lid", lid);
                    query.setParameter("gid", gid);
                    query.setParameter("sid", sid);
                    query.setParameter("pid", pid);
                    query.setParameter("qid", qid);
                    DataContext context;
                    try {
                        query.setMaxResults(1);
                        context = query.getSingleResult();
                    } catch (NoResultException e) {
                        context = null;
                    }
                    if (context != null) {
                        ArrayList<DataContext> t = new ArrayList<>();
                        t.add(context);
                        p.setDataSet(t);
                    }
                }
                em.close();
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("history")
    @Produces(MediaType.APPLICATION_JSON)
    public DataContextHistoryPack getHistory(
            @QueryParam("context") Long contextId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        DataContextHistoryPack p = new DataContextHistoryPack();
        if (isValidSession(sessionId, userId)) {
            p.setDataSet(null, 0L);
            EntityManager em = getEntityManager();
            EntityManager drupalEm = getDrupalEntityManager();
            DataContext dc = em.find(DataContext.class, contextId);
            if (dc != null) {
                TypedQuery<HistoryEntry> query
                        = em.createNamedQuery("History.findByContextId",
                                HistoryEntry.class);
                query.setParameter("contextId", dc);
                List<HistoryEntry> entries = query.getResultList();
                Iterator<HistoryEntry> i = entries.iterator();

                while (i.hasNext()) {
                    HistoryEntry e = i.next();
                    String username = "unknown";
                    if (e.getActionedBy() == -1) {
                        username = "crawler";
                    } else {
                        AUser u = drupalEm.find(AUser.class, e.getActionedBy());
                        if (u == null) {
                            username = "unknown";
                        }
                    }
                    e.setUser(username);
                }
                p.setDataSet(entries);
            }
                em.close();
            drupalEm.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
