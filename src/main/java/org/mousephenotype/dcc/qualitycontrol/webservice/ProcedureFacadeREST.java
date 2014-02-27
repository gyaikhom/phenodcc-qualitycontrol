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
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.impress.Pipeline;
import org.mousephenotype.dcc.entities.impress.Procedure;
import org.mousephenotype.dcc.entities.qc.StateAndUnresolvedIssuesCount;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.ProcedurePack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("procedures")
public class ProcedureFacadeREST extends AbstractFacade<Procedure> {

    public ProcedureFacadeREST() {
        super(Procedure.class);
    }

    @GET
    @Path("extjs/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public ProcedurePack extjsFind(
            @PathParam("id") Short id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        ProcedurePack p = new ProcedurePack();
        if (isValidSession(sessionId, userId)) {
            ArrayList<Procedure> t = new ArrayList<>();
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
    public ProcedurePack extjsFindAll(
            @QueryParam("cid") Integer centreId,
            @QueryParam("lid") Integer pipelineId,
            @QueryParam("gid") Integer genotypeId,
            @QueryParam("sid") Integer strainId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        ProcedurePack p = new ProcedurePack();
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            Pipeline pipeline = em.find(Pipeline.class, pipelineId);
            if (pipeline != null) {
                TypedQuery<Procedure> q = em.createNamedQuery(
                        "Procedure.findByPipelineId", Procedure.class);
                q.setParameter("pipelineId", pipeline);
                List<Procedure> temp = q.getResultList();

                if (centreId != null && centreId > -1 && pipelineId > -1
                        && genotypeId != null && genotypeId > -1
                        && strainId != null && strainId > -1) {
                    Iterator<Procedure> i = temp.iterator();
                    if (i.hasNext()) {
                        TypedQuery<StateAndUnresolvedIssuesCount> c =
                                em.createNamedQuery(
                                "DataContext.findProcedureState",
                                StateAndUnresolvedIssuesCount.class);
                        c.setParameter("centreId", centreId);
                        c.setParameter("pipelineId", pipelineId);
                        c.setParameter("genotypeId", genotypeId);
                        c.setParameter("strainId", strainId);

                        while (i.hasNext()) {
                            Procedure proc = i.next();
                            c.setParameter("procedureId", proc.getProcedureId());
                            try {
                                StateAndUnresolvedIssuesCount stateAndCount =
                                        c.getSingleResult();
                                if (stateAndCount != null) {
                                    proc.setStateId(stateAndCount.getStateId());
                                    proc.setNumUnresolved(stateAndCount.getNumUnresolved());
                                }
                            } catch (NoResultException e) {
                                proc.setStateId((short) 0); /* default: no data */
                            }
                        }
                    }
                }
                p.setDataSet(temp);
            }
            em.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
