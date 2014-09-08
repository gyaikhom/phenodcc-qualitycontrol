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

import org.mousephenotype.dcc.entities.impress.Parameter;
import org.mousephenotype.dcc.entities.impress.ProcedureHasParameters;
import org.mousephenotype.dcc.entities.impress.ParameterHasOptions;
import org.mousephenotype.dcc.entities.impress.ParamIncrement;
import org.mousephenotype.dcc.entities.impress.Procedure;
import org.mousephenotype.dcc.entities.impress.ParamOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.NoResultException;
import javax.persistence.TypedQuery;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.qualitycontrol.entities.ParameterData;
import org.mousephenotype.dcc.entities.qc.StateAndUnresolvedIssuesCount;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.ParameterDataPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("parameters")
public class ParameterDataFacadeREST extends AbstractFacade<Parameter> {

    public ParameterDataFacadeREST() {
        super(Parameter.class);
    }

    private Integer convertGraphType(String graphType) {
        Integer code = 0;
        switch (graphType) {
            case "1D":
                code = 1;
                break;
            case "2D":
                code = 2;
                break;
            case "CATEGORICAL":
                code = 3;
                break;
        }
        return code;
    }

    private List<String> getOptions(
            Collection<ParameterHasOptions> parameterHasoptions) {
        List<String> options = new ArrayList<>();
        Iterator<ParameterHasOptions> i = parameterHasoptions.iterator();
        while (i.hasNext()) {
            ParameterHasOptions p = i.next();
            ParamOption o = p.getParamOptionId();
            if (!o.getDeleted() && o.getIsActive()) {
                options.add(o.getName());
            }
        }
        return options;
    }

    private ParameterData fillIncrement(
            ParameterData pd,
            Parameter p) {
        Collection<ParamIncrement> phic
                = p.getParamIncrementCollection();
        Iterator<ParamIncrement> pici = phic.iterator();
        if (pici.hasNext()) {
            ParamIncrement pi = pici.next();
            if (pi.getDeleted() == false) {
                pd.setIncrementId(pi.getParamIncrementId());
                pd.setIncrementMin(pi.getIncrementMin());
                pd.setIncrementType(pi.getIncrementType());
                pd.setIncrementUnit(pi.getIncrementUnit());
                pd.setIncrementValue(pi.getIncrementString());
            }
        }
        return pd;
    }

    private ParameterData fillParameterDetails(
            ParameterData pd,
            ProcedureHasParameters pphp,
            EntityManager em) {
        Parameter p = em.find(Parameter.class,
                pphp.getParameterId().getParameterId());
        if (p != null) {
            pd.setParameterId(p.getParameterId());
            pd.setParameterName(p.getName());
            pd.setStableid(p.getParameterKey());
            pd.setGraphType(convertGraphType(p.getGraphType()));
            pd.setDatatype(p.getValueType());
            pd.setUnit(p.getUnit().getUnit());
            pd.setOptions(getOptions(p.getParameterHasOptionsCollection()));
            pd.setUsableQcBound((short) (p.getQcCheck() ? 1 : 0));
            pd.setQcMax(p.getQcMax());
            pd.setQcMin(p.getQcMin());
            pd.setRequired((short) (p.getIsRequired() ? 1 : 0));
            pd = this.fillIncrement(pd, p);
        }
        return pd;
    }

    private List<ParameterData> getParameters(
            Collection<ProcedureHasParameters> pphpc,
            EntityManager em,
            Integer centreId,
            Integer pipelineId,
            Integer genotypeId,
            Integer strainId,
            Integer procedureId) {
        boolean updateState = centreId != null && centreId > -1
                && pipelineId != null && pipelineId > -1
                && genotypeId != null && genotypeId > -1
                && strainId != null && strainId > -1
                && procedureId != null && procedureId > -1;
        List<ParameterData> pdl = new ArrayList<>();
        Iterator<ProcedureHasParameters> pphpci
                = pphpc.iterator();
        if (pphpci.hasNext()) {
            TypedQuery<StateAndUnresolvedIssuesCount> c = em.createNamedQuery(
                    "DataContext.findParameterState",
                    StateAndUnresolvedIssuesCount.class);
            if (updateState) {
                c.setParameter("centreId", centreId);
                c.setParameter("pipelineId", pipelineId);
                c.setParameter("genotypeId", genotypeId);
                c.setParameter("strainId", strainId);
                c.setParameter("procedureId", procedureId);
            }

            while (pphpci.hasNext()) {
                ProcedureHasParameters pphp = pphpci.next();
                Parameter p = pphp.getParameterId();

                if (p.getGraphType() == null
                        || "procedureMetadata".equals(p.getType())) {
                    continue;
                }

                ParameterData pd = new ParameterData();
                pd.setProcedureId(pphp.getProcedureId().getProcedureId());
                pd.setWeight(pphp.getWeight());

                pd = this.fillParameterDetails(pd, pphp, em);

                /* fill context state */
                if (updateState) {
                    c.setParameter("parameterId", p.getParameterId());
                    try {
                        StateAndUnresolvedIssuesCount stateAndCount
                                = c.getSingleResult();
                        if (stateAndCount != null) {
                            pd.setStateId(stateAndCount.getStateId());
                            pd.setNumUnresolved(stateAndCount.getNumUnresolved());
                        }
                    } catch (NoResultException e) {
                        pd.setStateId((short) 0); /* default: no data */

                    }
                }
                pdl.add(pd);
            }
        }
        return pdl;
    }
    private Comparator<ProcedureHasParameters> comparator
            = new Comparator<ProcedureHasParameters>() {
                @Override
                public int compare(ProcedureHasParameters a, ProcedureHasParameters b) {
                    String name = a.getParameterId().getName(),
                    key = a.getParameterId().getParameterKey();
                    int value = name.compareTo(b.getParameterId().getName());
                    if (value == 0) {
                        value = key.compareTo(b.getParameterId().getParameterKey());
                    }
                    return value;
                }
            };

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public ParameterDataPack extjsFindByProcedureId(
            @QueryParam("cid") Integer centreId,
            @QueryParam("lid") Integer pipelineId,
            @QueryParam("gid") Integer genotypeId,
            @QueryParam("sid") Integer strainId,
            @QueryParam("pid") Integer procedureId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        ParameterDataPack p = new ParameterDataPack();
        if (isValidSession(sessionId, userId)) {
            List<ParameterData> pdl = null;
            EntityManager em = getEntityManager();
            Procedure pp = em.find(Procedure.class, procedureId);
            if (pp != null) {
                Collection<ProcedureHasParameters> pphpc
                        = pp.getProcedureHasParametersCollection();
                if (pphpc != null) {
                    List<ProcedureHasParameters> list
                            = new ArrayList<>(pphpc);
                    Collections.sort(list, comparator);
                    pdl = this.getParameters(list, em, centreId,
                            pipelineId, genotypeId, strainId, procedureId);
                }
            }
            em.close();
            p.setDataSet(pdl);
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
