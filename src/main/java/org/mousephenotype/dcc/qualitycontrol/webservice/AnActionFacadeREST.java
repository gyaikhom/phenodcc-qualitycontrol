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
import org.mousephenotype.dcc.qualitycontrol.entities.AnActionRequest;
import org.mousephenotype.dcc.qualitycontrol.entities.AnActionResponse;
import org.mousephenotype.dcc.entities.qc.AUser;
import org.mousephenotype.dcc.entities.qc.AnAction;
import org.mousephenotype.dcc.entities.qc.AnIssue;
import org.mousephenotype.dcc.entities.qc.DataContext;
import org.mousephenotype.dcc.entities.qc.History;
import org.mousephenotype.dcc.entities.qc.IssueStatus;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.AnActionPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("actions")
public class AnActionFacadeREST extends AbstractFacade<AnAction> {

    /* the following must match cid in phenodcc_qc.action_type */
    private static final Integer ACCEPT_ISSUE = 2;
    private static final Integer RESOLVE_ISSUE = 4;
    /* the following must match cid in phenodcc_qc.issue_status */
    private static final Integer ISSUE_ACCEPTED = 1;
    private static final Integer ISSUE_RESOLVED = 4;

    public AnActionFacadeREST() {
        super(AnAction.class);
    }

    @POST
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public AnAction createAction(AnActionRequest entity,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnAction action;
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            action = entity.getAction(em);

            em.getTransaction().begin();
            em.persist(action);
            em.flush();
            em.refresh(action);

            DataContext context = action.getIssueId().getContextId();
            em.persist(new History(context, userId, action.getActionType(),
                    context.getStateId(), action, action.getIssueId()));

            Integer actionType = entity.getActionType();
            Integer issueStatus = -1;

            if (actionType == ACCEPT_ISSUE) {
                issueStatus = ISSUE_ACCEPTED;
            } else if (actionType == RESOLVE_ISSUE) {
                issueStatus = ISSUE_RESOLVED;
            }

            if (issueStatus != -1) {
                TypedQuery<IssueStatus> query =
                        em.createNamedQuery("IssueStatus.findByCid",
                        IssueStatus.class);
                query.setParameter("cid", issueStatus);
                query.setMaxResults(1);
                IssueStatus status = query.getSingleResult();
                if (status != null) {
                    AnIssue issue = action.getIssueId();
                    issue.setStatus(status);

                    if (actionType == RESOLVE_ISSUE
                            && context.getNumIssues() > context.getNumResolved()) {
                        context.setNumResolved(context.getNumResolved() + 1);
                    }
                }
            }
            em.getTransaction().commit();
            em.refresh(action);
            em.close();
        } else {
            action = null;
        }
        return action;
    }

    private AUser getUser(Integer id, EntityManager em) {
        AUser r = null;
        try {
            r = em.find(AUser.class, id);
        } catch (Exception e) {
            System.err.println("Unable to find user with id "
                    + id + " in Drupal database.");
        }
        return r;
    }

    private AnActionResponse prepareActionResponse(AnAction action) {
        AnActionResponse returnValue = null;
        if (action != null) {
            EntityManager em = getEntityManager();
            AUser actionedBy = getUser(action.getActionedBy(), em);
            if (actionedBy == null) {
                System.err.println("Failed to retrieve action details from database");
            } else {
                returnValue = new AnActionResponse(action.getId(),
                        action.getDescription(),
                        actionedBy.toString(),
                        action.getActionType().getShortName(),
                        action.getLastUpdate().getTime());
            }
            em.close();
        }
        return returnValue;
    }

    @GET
    @Path("extjs/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public AnActionPack extjsFind(
            @PathParam("id") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnActionPack p = new AnActionPack();
        if (isValidSession(sessionId, userId)) {
            AnAction action = super.find(id);
            if (action == null) {
                p.setDataSet(null, 0L);
            } else {
                ArrayList<AnActionResponse> t =
                        new ArrayList<>();
                t.add(prepareActionResponse(action));
                p.setDataSet(t);
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("extjs/all")
    @Produces(MediaType.APPLICATION_JSON)
    public AnActionPack extjsFindAll(
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnActionPack p = new AnActionPack();
        if (isValidSession(sessionId, userId)) {
            List<AnAction> actions = super.findAll();
            if (actions.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                ArrayList<AnActionResponse> t =
                        new ArrayList<>();
                Iterator<AnAction> i = actions.iterator();
                while (i.hasNext()) {
                    t.add(prepareActionResponse(i.next()));
                }
                p.setDataSet(t);
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public AnActionPack extjsFindByIssue(
            @QueryParam("issueId") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnActionPack p = new AnActionPack();
        if (isValidSession(sessionId, userId)) {
            p.setDataSet(null, 0L);

            EntityManager em = getEntityManager();
            AnIssue issue = em.find(AnIssue.class, id);
            if (issue != null) {
                TypedQuery<AnAction> actionQuery =
                        em.createNamedQuery("AnAction.findByIssueId",
                        AnAction.class);
                actionQuery.setParameter("issueId", issue);
                try {
                    List<AnAction> actions = actionQuery.getResultList();
                    if (!actions.isEmpty()) {
                        ArrayList<AnActionResponse> t =
                                new ArrayList<>();
                        Iterator<AnAction> i = actions.iterator();
                        while (i.hasNext()) {
                            t.add(prepareActionResponse(i.next()));
                        }
                        p.setDataSet(t);
                    }
                } catch (NoResultException e) {
                }
            }
            em.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
