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

import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.overviews.MeasuredValues;
import org.mousephenotype.dcc.entities.overviews.ProcedureAnimalOverview;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.MeasurementsPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("measurements")
public class MeasurementsFacadeREST extends AbstractFacade<MeasuredValues> {

    public MeasurementsFacadeREST() {
        super(MeasuredValues.class);
    }

    private List<MeasuredValues> getMutantMeasurements(
            Integer centreId,
            Integer pipelineId,
            Integer genotypeId,
            Integer strainId,
            String procedureKey,
            String parameterKey) {
        EntityManager em = getEntityManager();
        TypedQuery<MeasuredValues> query =
                em.createNamedQuery(
                "MeasurementsPerformed.findMutantMeasurements",
                MeasuredValues.class);
        query.setParameter("centreId", centreId);
        query.setParameter("pipelineId", pipelineId);
        query.setParameter("genotypeId", genotypeId);
        query.setParameter("strainId", strainId);
        query.setParameter("procedureKey", procedureKey);
        query.setParameter("parameterKey", parameterKey);
        List<MeasuredValues> temp = query.getResultList();
        em.close();
        return temp;
    }

    private List<MeasuredValues> getBaselineMeasurements(
            ProcedureAnimalOverview pao,
            String parameterKey) {
        EntityManager em = getEntityManager();
        TypedQuery<MeasuredValues> query =
                em.createNamedQuery(
                "MeasurementsPerformed.findBaselineMeasurements",
                MeasuredValues.class);
        query.setParameter("centreId", pao.getCentreId());
        query.setParameter("pipeline", pao.getPipeline());
        query.setParameter("strainId", pao.getStrainId());
        query.setParameter("procedureId", pao.getProcedureId());
        query.setParameter("parameterId", parameterKey);
        query.setParameter("metadataGroup", pao.getMetadataGroup());
        List<MeasuredValues> temp = query.getResultList();
        em.close();
        return temp;
    }

    public ProcedureAnimalOverview getProcedureAnimalOverview(
            Integer centreId, Integer pipelineId, Integer genotypeId,
            Integer strainId, String parameterId) {
        ProcedureAnimalOverview pao = null;
        EntityManager em = getEntityManager();
        TypedQuery<ProcedureAnimalOverview> q =
                em.createNamedQuery("ProcedureAnimalOverview.findByCidLidGidSidQeid",
                ProcedureAnimalOverview.class);
        q.setParameter("centreId", centreId);
        q.setParameter("pipelineId", pipelineId);
        q.setParameter("genotypeId", genotypeId);
        q.setParameter("strainId", strainId);
        q.setParameter("parameterId", parameterId);
        q.setMaxResults(1);
        try {
            pao = q.getSingleResult();
        } catch (Exception e) {
        }
        em.close();
        return pao;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public MeasurementsPack extjsFindBy(
            @QueryParam("cid") Integer centreId,
            @QueryParam("lid") Integer pipelineId,
            @QueryParam("gid") Integer genotypeId,
            @QueryParam("sid") Integer strainId,
            @QueryParam("peid") String procedureKey,
            @QueryParam("qeid") String parameterKey,
            @QueryParam("ib") Boolean includeBaseline,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        MeasurementsPack p = new MeasurementsPack();
        if (isValidSession(sessionId, userId)) {
            if (centreId == null || pipelineId == null
                    || genotypeId == null || strainId == null
                    || procedureKey == null || procedureKey.isEmpty()
                    || parameterKey == null || parameterKey.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                ProcedureAnimalOverview pao =
                        getProcedureAnimalOverview(centreId, pipelineId,
                        genotypeId, strainId, parameterKey);
                if (pao == null) {
                    p.setDataSet(null, 0L);
                } else {
                    List<MeasuredValues> temp =
                            getMutantMeasurements(centreId, pipelineId,
                            genotypeId, strainId, procedureKey, parameterKey);
                    if (genotypeId != 0 && includeBaseline != null && includeBaseline) {
                        temp.addAll(getBaselineMeasurements(pao, parameterKey));
                    }
                    p.setDataSet(temp);
                }
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
